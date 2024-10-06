// Import statements
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

// Configure Multer
const upload = multer({ dest: "upload/" });
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ensure directories exist
const ensureDirectories = async () => {
    await fsPromises.mkdir("upload", { recursive: true });
    await fsPromises.mkdir("download", { recursive: true });
};
ensureDirectories();

// Handle image upload and analysis
app.post("/getInfo", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file uploaded" });
        }

        const imagePath = req.file.path;
        const imageData = await fsPromises.readFile(imagePath, { encoding: "base64" });

        // Use the Gemini Flash Model to analyze the image
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([
            "Analyze this image and provide Detailed Information, How to do this workout, Benefits, Care Instructions, and Some Interesting Facts. Please provide the response in plain text without using any markdown format.",
            {
                inlineData: {
                    mimeType: req.file.mimetype,
                    data: imageData,
                },
            },
        ]);

        const workoutInfo = result.response.text();

        // Clean up
        await fsPromises.unlink(imagePath);

        // Respond with the result and the image data
        res.json({
            result: workoutInfo,
            image: `data:${req.file.mimetype};base64,${imageData}`,
        });
    } catch (error) {
        console.error("Error analyzing this image:", error);
        res.status(500).json({ error: "An error occurred while analyzing this image!" });
    }
});

// Download PDF
app.post("/downloadPDF", express.json(), async (req, res) => {
    const { result, image } = req.body;
    try {
        const filename = `workout_info_${Date.now()}.pdf`;
        const filePath = path.join("download", filename);
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        // Add content to the PDF
        doc.fontSize(32).text("Workout Info", { align: "left" });

        if (image) {
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            doc.image(buffer, { fit: [300, 300], align: "center", valign: "center" });
            doc.moveDown(); // Move to the next line after the image
        }

        doc.fontSize(16).text(result, { align: "left" });
        doc.end();

        // Wait for the PDF to be created
        await new Promise((resolve, reject) => {
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
        });

        // Send the file for download
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error downloading the PDF:", err);
                return res.status(500).json({ error: "Error downloading the PDF!" });
            }
            fsPromises.unlink(filePath).catch(console.error); // Clean up the PDF file
        });
    } catch (error) {
        console.error("Error generating the PDF:", error);
        res.status(500).json({ error: "An error occurred while generating the PDF report!" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`App is listening on port: ${port}`);
});

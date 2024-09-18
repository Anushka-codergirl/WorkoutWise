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

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.use(express.static("public"));

app.post("/getInfo", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const imagePath = req.file.path;
    const imageData = await fsPromises.readFile(imagePath, {
      encoding: "base64",
    });

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
    res
      .status(500)
      .json({ error: "An error occurred while analyzing this image!" });
  }
});

//download pdf
app.post("/downloadPDF", express.json(), async (req, res) => {
  const { result, image } = req.body;
  try {
    // Ensure the download directory exists
    const downloadDir = path.join(__dirname, "download");
    await fsPromises.mkdir(downloadDir, { recursive: true });
    // Generate pdf
    const filename = `workout_info${Date.now()}.pdf`;
    const filePath = path.join(downloadDir, filename);
    const writeStream = fs.createWriteStream(filePath);
    const doc = new PDFDocument();
    doc.pipe(writeStream);
    // Adding content to the PDF
    doc.fontSize(32).text("Workout Info", {
      align: "left",
    });
    // Workout Image in the pdf
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const imageHeight = 300; // Height of the image
      const imageY = doc.y; // Get the current Y position after the image is placed
      doc.image(buffer, {
        fit: [300, 300],
        align: "center",
        valign: "center",
      });
      // Set the Y position for text to be after the image (current Y + image height)
      doc.y = imageY + imageHeight + 2; 
    }

    doc.fontSize(16).text(result, { align: "left" });
    doc.end();

    //wait for the pdf to be created
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: "Error downloading the PDF!" });
      }
      fsPromises.unlink(filePath);
    });
  } catch (error) {
    console.error("Error generating the PDF:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report!" });
  }
});

//start the server
app.listen(port, () => {
  console.log(`App is listening on port: ${port}`);
});
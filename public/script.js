const form = document.getElementById("form");
const inputImage = document.getElementById("inputImg");
const imagePreview = document.getElementById("imgPreview");
const resultContainer = document.getElementById("result");
const loader = document.getElementById("loader");
const downloadButton = document.getElementById("downloadBtn");
const dropArea = document.getElementById("dropArea");
let result = "";
let image = "";

// Event Listeners for Drag and Drop
dropArea.addEventListener("click", () => inputImage.click());

dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.style.backgroundColor = "#e8f4fd";
});

dropArea.addEventListener("dragleave", () => {
    dropArea.style.backgroundColor = "";
});

dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.style.backgroundColor = "";
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        inputImage.files = e.dataTransfer.files;
        handleImageUpload(file);
    }
});

// Handle image upload and preview
inputImage.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
    };
    reader.readAsDataURL(file);
}

// Handle Form Submission
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check whether an image file is selected or not
    if (inputImage.files.length === 0) {
        resultContainer.textContent = "Error: Please upload an image.";
        resultContainer.style.display = "block";
        return;
    }

    const formData = new FormData(e.target);
    loader.style.display = "block";
    resultContainer.style.display = "none";
    resultContainer.textContent = "";
    downloadButton.style.display = "none";

    try {
        const response = await fetch("/getInfo", {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        if (data.result) {
            result = data.result;
            image = data.image;
            resultContainer.innerHTML =
                "<h2>Here's the result:</h2><p>" + result.replace(/\n/g, "<br>") + "</p>";
            resultContainer.style.display = "block";
            downloadButton.style.display = "block";
        } else if (data.error) {
            resultContainer.textContent = "Error: " + data.error;
            resultContainer.style.display = "block";
        }
    } catch (error) {
        resultContainer.textContent = "Error: " + error.message;
        resultContainer.style.display = "block";
    } finally {
        loader.style.display = "none";
    }
});

// Handle download button click
downloadButton.addEventListener("click", async () => {
    const response = await fetch("/downloadPDF", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            result: result,
            image: image,
        }),
    });
    if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "WorkoutInfo.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    } else {
        alert("Failed to generate and download the PDF.");
    }
});

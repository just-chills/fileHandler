const serverUrl = "http://localhost:5000";
function uploadFile() {
  const fileInput = document.getElementById("fileInput").files[0];
  if (!fileInput) return alert("Please select a file");
  const formData = new FormData();
  formData.append("file", fileInput);
  fetch(`${serverUrl}/upload`, { method: "POST", body: formData })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("uploadStatus").textContent = data.message;
      loadFileList(); // โหลดรายการไฟลŤใหมŠ
    })
    .catch((error) => console.error("Upload error:", error));
}
function loadFileList() {
  fetch(`${serverUrl}/files`)
    .then((response) => response.json())
    .then((files) => {
      const fileList = document.getElementById("fileList");
      fileList.innerHTML = "";
      files.forEach((file) => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${serverUrl}/download/${file}" download>${file}</a>`;
        fileList.appendChild(li);
      });
    })
    .catch((error) => console.error("Error loading file list:", error));
}
loadFileList();

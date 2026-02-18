const serverUrl = "http://localhost:5000";
const adminUsername = "admin";
const adminRole = "admin";

// ดึงเฉพาะ files โดยเพิ่ม key "files" เพราะ Backend response อาจเป็น object
function getHeadersAdmin(from = null) {
  const headers = {
    'x-username': adminUsername,
    'x-user-role': adminRole,
    'Content-Type': 'application/json'
  };
  return headers;
}

function loadFileListAdmin() {
  const headers = getHeadersAdmin();
  
  fetch(`${serverUrl}/files`, { headers })
    .then((response) => response.json())
    .then((data) => {
      const fileList = document.getElementById("fileList");
      fileList.innerHTML = "";
      
      // ตรวจสอบ response format
      const files = data.files || data;
      
      if (typeof files === 'object' && !Array.isArray(files)) {
        // files เป็น object {username: [files]}
        for (const [username, userFiles] of Object.entries(files)) {
          const section = document.createElement("div");
          section.className = "user-section";
          
          const userTitle = document.createElement("h4");
          userTitle.textContent = `📁 ${username}`;
          userTitle.className = "user-title";
          section.appendChild(userTitle);
          
          const ul = document.createElement("ul");
          ul.className = "file-list";
          
          if (Array.isArray(userFiles) && userFiles.length > 0) {
            userFiles.forEach((file) => {
              const li = document.createElement("li");
              li.className = "file-item";
              
              li.innerHTML = `
                <span class="file-name">${file}</span>
                <div class="file-actions">
                  <button onclick="previewFileAdmin('${file}', '${username}')" class="btn-preview">👁️ Preview</button>
                  <button onclick="downloadFileAdmin('${file}', '${username}')" class="btn-download">⬇️ Download</button>
                  <button onclick="deleteFileAdmin('${file}', '${username}')" class="btn-delete">🗑️ Delete</button>
                </div>
              `;
              ul.appendChild(li);
            });
          } else {
            const emptyLi = document.createElement("li");
            emptyLi.textContent = "No files";
            emptyLi.className = "empty";
            ul.appendChild(emptyLi);
          }
          
          section.appendChild(ul);
          fileList.appendChild(section);
        }
      } else if (Array.isArray(files)) {
        // files เป็น array
        files.forEach((file) => {
          const li = document.createElement("li");
          li.className = "file-item";
          li.innerHTML = `
            <span class="file-name">${file}</span>
            <div class="file-actions">
              <button onclick="previewFileAdmin('${file}', 'admin')" class="btn-preview">👁️ Preview</button>
              <button onclick="downloadFileAdmin('${file}', 'admin')" class="btn-download">⬇️ Download</button>
              <button onclick="deleteFileAdmin('${file}', 'admin')" class="btn-delete">🗑️ Delete</button>
            </div>
          `;
          fileList.appendChild(li);
        });
      }
    })
    .catch((error) => console.error("Error loading file list:", error));
}

function previewFileAdmin(filename, username) {
  const headers = getHeadersAdmin();
  const url = `${serverUrl}/preview/${filename}?from=${username}`;
  
  fetch(url, { headers })
    .then((response) => {
      if (!response.ok) throw new Error('Preview failed');
      return response.blob();
    })
    .then((blob) => {
      const fileUrl = window.URL.createObjectURL(blob);
      window.open(fileUrl, '_blank');
    })
    .catch((error) => {
      alert('Error: ' + error.message);
      console.error("Preview error:", error);
    });
}

function downloadFileAdmin(filename, username) {
  const headers = getHeadersAdmin();
  const url = `${serverUrl}/download/${filename}?from=${username}`;
  
  fetch(url, { headers })
    .then((response) => {
      if (!response.ok) throw new Error('Download failed');
      return response.blob();
    })
    .then((blob) => {
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(a.href);
    })
    .catch((error) => {
      alert('Error: ' + error.message);
      console.error("Download error:", error);
    });
}

function deleteFileAdmin(filename, username) {
  if (!confirm(`Are you sure you want to delete "${filename}" from ${username}?`)) {
    return;
  }
  
  const headers = getHeadersAdmin();
  const url = `${serverUrl}/files/${filename}?from=${username}`;
  
  fetch(url, { 
    method: 'DELETE',
    headers
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        alert('Error: ' + data.error);
      } else {
        alert('File deleted successfully');
        loadFileListAdmin();
      }
    })
    .catch((error) => {
      alert('Error: ' + error.message);
      console.error("Delete error:", error);
    });
}

// Load file list on page load
loadFileListAdmin();

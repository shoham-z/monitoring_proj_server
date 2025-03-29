async function loadSwitchData() {
    try {
      const response = await fetch('/api/getAll');  // Call backend API
      const switches = await response.json();

      console.log("Switch data:", switches);

      const tableBody = document.querySelector("tbody");
      tableBody.innerHTML = ""; // Clear table

      switches.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.ip}</td>
          <td>${row.name}</td>
          <td>
            <button class="edit-btn" onclick="editRow('${row.ip}', '${row.name}')">Edit</button>
            <button class="delete-btn" onclick="deleteRow('${row.ip}')">Delete</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error loading switch data:", error);
    }
}

function toggleForm(formID) {
    var formMenu = document.getElementById(formID);
    if (formMenu.style.display === "none" || formMenu.style.display === "") {
      formMenu.style.display = "block";
    } else {
      formMenu.style.display = "none";
    }
}

function editRow(ip, name) {
    console.log(`Editing row with IP: ${ip} and Name: ${name}`);

    // Set placeholders for IP Address and Name fields
    const ipElement = document.getElementById("IP Address");
    const nameElement = document.getElementById("Name");
    ipElement.placeholder = ip;
    nameElement.placeholder = name;
    document.getElementById("oldIp").value = ip;

    ipElement.value = "";
    nameElement.value = "";

    // Show the form menu
    toggleForm("editMenu");
}

function addRow(ip, name) {
    console.log(`Adding row with IP: ${ip} and Name: ${name}`);

    // Show the form menu
    toggleForm("addMenu");

    const formData = {
        ip: ip,
        name: name
      };
    
    fetch('/api/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Indicating we're sending JSON data
        },
        body: JSON.stringify(formData) // Convert data to JSON format
      })
      .then(response => response.json())
      .then(data => {
        // Optionally, handle a successful response (e.g., display a message)
        alert("Added Successfully!");
        // Optionally close the form
        window.location.reload();
      })
      .catch(error => {
        console.error('Error during row deletion:', error);
        // Optionally, handle an error (e.g., show an error message)
        alert("Error deleting the row. Please try again.");
      });
}

function deleteRow(ip) {
    console.log(`Deleting row with IP: ${ip}`);
    const confirmationPopup = document.getElementById('deleteConfirm');
    toggleForm("deleteConfirm");

    // Add the event listener to "Yes, delete" only once
    const confirmDeleteButton = document.getElementById('confirmDelete');
    confirmDeleteButton.onclick = function() {
      // Here you would handle the actual deletion, such as making an AJAX request
            // Create the data object to send in the request
    const formData = {
      ip: ip
    };


    fetch('/api/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json', // Indicating we're sending JSON data
      },
      body: JSON.stringify(formData) // Convert data to JSON format
    })
    .then(response => response.json())
    .then(data => {
      // Optionally, handle a successful response (e.g., display a message)
      alert("Deleted Successfully!");
      // Optionally close the form
      window.location.reload();
    })
    .catch(error => {
      console.error('Error during row deletion:', error);
      // Optionally, handle an error (e.g., show an error message)
      alert("Error deleting the row. Please try again.");
    });

      // Close the popup after confirming deletion
      confirmationPopup.style.display = 'none';
    };
}
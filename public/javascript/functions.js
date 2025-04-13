// Session timeout duration (10 minutes)
const sessionTimeoutDuration =  1000 * 60 * 10; // 10 minutes in milliseconds
let sessionTimeout;

async function loadSwitchData() {
  try {
      const response = await fetch('/api/getAll');

      if (!response || !response.ok) {
          throw new Error("Server offline");
      }

      const switches = await response.json();
      console.log("Switch data:", switches);

      const tableBody = document.querySelector("tbody");
      tableBody.innerHTML = ""; // Clear table

      switches.forEach(row => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
              <td>${row.ip}</td>
              <td>${row.name}</td>
              <td style="white-space: nowrap;">
                  <button id="edit ${row.ip}"class="edit-btn" onclick="setMenu('${"edit"}', '${row.ip}', '${row.name}')">Edit</button>
                  <button id="add ${row.ip}"class="delete-btn" onclick="deleteRow('${row.ip}')">Delete</button>
              </td>
          `;
          tableBody.appendChild(tr);
      });

      setTimeout(async () => {
          await loadSwitchData();
          filterTable();
      }, 30_000);
  } catch {
    toggleForm("closedH1");
    document.querySelectorAll("button").forEach(btn => btn.disabled = true);
  }
}

function resetSessionTimeout() {
  console.log(sessionTimeout)
  clearTimeout(sessionTimeout); // Clear the existing timeout
  sessionTimeout = setTimeout(function() {
    window.location.href = '/'; // Redirect after 10 minutes of inactivity
  }, sessionTimeoutDuration); // Restart the 10-minute countdown
  console.log(sessionTimeout)
}

function isValidIp(ip) {
  const ipPattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  return ipPattern.test(ip);
}

function edit(event){ 
  event.preventDefault();
  const ipElement = document.getElementById("IP Address");
  const nameElement = document.getElementById("Name");
  var ip = ipElement.value;
  var name = nameElement.value;
  const oldIp = document.getElementById("oldIp").value;

  if (!ip && !name) {
    alert("Please fill out at least one field (IP Address or Name).");
    return;
  } else if (!ip && name){
    ip = oldIp;
  } else if (ip && !name){
    name = nameElement.placeholder;
  }

  if (!isValidIp(ip)){return document.getElementById("invalid-ip").style.display = "block";}

  const formData = {
    ip: ip,
    name: name,
    oldIp: oldIp
  };

  fetch('/api/edit', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(async data => {
    console.log('Form submission successful:', data);
    alert("Edited Successfully!");
    update("Menu");
  })
  .catch(error => {
    console.error('Error during form submission:', error);
    alert("Error submitting the form. Please try again.");
  });
}

function toggleForm(ID, close) {
  //Closes other menus
  var menu2;
  if (ID === "Menu"){menu2 = document.getElementById("deleteConfirm");}
  else if (ID === "deleteConfirm"){menu2 = document.getElementById("Menu");}
  menu2.style.display = "none";

  // Toggle the clicked menu
  const menu = document.getElementById(ID);
  if (close){menu.style.display = "none";}
  else {menu.style.display = "block";}
}

function setMenu(type, ip, name) {
    console.log(`${type} row with IP: ${ip} and Name: ${name}`);

    const submit = document.getElementById("submit");

    const ipElement = document.getElementById("IP Address");
    const nameElement = document.getElementById("Name");
    ipElement.value = "";
    nameElement.value = "";
    document.getElementById("invalid-ip").style.display = "none";
    const h2 = document.getElementById("MenuH2");

    if (type === "edit"){
      document.getElementById("oldIp").value = ip;
      ipElement.placeholder = ip;
      nameElement.placeholder = name;
      h2.textContent = "Edit Menu";
      submit.onclick = (event) => edit(event);
    } else {
      ipElement.placeholder = "";
      nameElement.placeholder = "";
      h2.textContent = "Add Menu";
      submit.onclick = (event) => add(event);
    }

    toggleForm("Menu")
}

function deleteRow(ip) {
    console.log(`Deleting row with IP: ${ip}`);
    const confirmationPopup = document.getElementById('deleteConfirm');
    toggleForm("deleteConfirm");

    const confirmDeleteButton = document.getElementById('confirmDelete');
    confirmDeleteButton.onclick = function() {
      const formData = {
        ip: ip
      };

      fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })
      .then(response => response.json())
      .then(data => {
        alert("Deleted Successfully!");
        window.location.reload();
      })
      .catch(error => {
        console.error('Error during row deletion:', error);
        alert("Error deleting the row. Please try again.");
      });

      confirmationPopup.style.display = 'none';
    };
}

function filterTable() {
  let input = document.getElementById("search-bar").value.toLowerCase();
  let rows = document.querySelectorAll("#table-body tr");

  rows.forEach(row => {
      let ip = row.cells[0].textContent.toLowerCase();
      let name = row.cells[1].textContent.toLowerCase();

      if (ip.includes(input) || name.includes(input)) {
          row.style.display = "";
      } else {
          row.style.display = "none";
      }
  });
}

async function userCheck() {
  event.preventDefault();
  console.log("Login form submitted!");

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
      const response = await fetch(`/api/login`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ username, password }),
          credentials: "include"
      });

      const data = await response.json();

      if (data && data.username) {
          alert("Login successful!");
          window.location.href = "admin.html";
      } else {
        document.getElementById("error-message").style.display = "block";
      }
  } catch (error) {
      console.error("Login error:", error);
      document.getElementById("error-message").innerText = "Server error. Try again.";
      document.getElementById("error-message").style.display = "block";
  }
}

async function update(formID){
  await loadSwitchData();
  filterTable();
  toggleForm(formID, true);
}

function add(event){
  event.preventDefault();
  const ip = document.getElementById("IP Address").value;
  const name = document.getElementById("Name").value;

  if (!isValidIp(ip)){return document.getElementById("invalid-ip").style.display = "block";}

  if (!ip || !name) {
    alert("Please fill out all fields.");
    return;
  }

  const formData = {
    ip: ip,
    name: name
  };

  fetch('/api/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(async data => {
    console.log('Form submission successful:', data);
    alert("Added Successfully!");

    update("Menu");
  })
  .catch(error => {
    console.error('Error during form submission:', error);
    alert("Error submitting the form. Please try again.");
  });
}

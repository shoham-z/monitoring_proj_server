const url = "http://localhost:3001";

// Session timeout duration (10 minutes)
const sessionTimeoutDuration =  1000 * 60 * 10; // 10 minutes in milliseconds
let sessionTimeout;

async function loadSwitchData() {
  try {
      const response = await fetch(`${url}/api/getAll`);

      if (!response || !response.ok) {
          throw new Error("Server offline");
      }

      const switches = await response.json();

      const tableBody = document.querySelector("tbody");
      tableBody.innerHTML = ""; // Clear table

      switches.forEach(row => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
              <td>${row.ip}</td>
              <td>${row.name}</td>
              <td style="white-space: nowrap;">
                  <button id="edit ${row.ip}"class="edit-btn" onclick="setMenu('${"edit"}', '${row.ip}', '${row.name}')">Edit</button>
                  <button id="add ${row.ip}"class="delete-btn" onclick="deleteRow('${row.ip}', '${row.name}')">Delete</button>
              </td>
          `;
          tableBody.appendChild(tr);
      });

      setTimeout(async () => {
          await loadSwitchData();
          filterTable();
      }, 30_000);
  } catch {
    const title = document.getElementById("title");
    title.className = "closed";
    title.textContent = "The Server Is Offline";
    document.querySelectorAll("button:not(.cancel-btn)").forEach(btn => btn.disabled = true);
  }
}

function resetSessionTimeout() {
  clearTimeout(sessionTimeout); // Clear the existing timeout
  sessionTimeout = setTimeout(function() {
    window.location.href = '/'; // Redirect after 10 minutes of inactivity
  }, sessionTimeoutDuration); // Restart the 10-minute countdown
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
    errorText("Please fill out at least one field\n (IP Address or Name).");
    return;
  } else if (!ip && name){
    ip = oldIp;
  } else if (ip && !name){
    name = nameElement.placeholder;
  }

  if (!isValidIp(ip)){
    errorText("Please enter a valid IP address");
    return;
  }

  const formData = {
    ip: ip,
    name: name,
    oldIp: oldIp
  };

  fetch(`${url}/api/edit`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(async data => {
    if (!data?.error){
      alert("Edited Successfully!");
      update("Menu");
    } else {errorText('IP and name must be unique');}
  })
  .catch(error => {
    console.error('Error during form submission:', error);
    errorText("Error submitting the form.\n Please try again.");
  });
}

function errorText(text){
  const element = document.getElementById("invalid-input");
  element.textContent = text;
  element.style.display = "block";
  alert(text.replace(/\n/g, ' '));
}

function toggleMenu(ID, close) {
  // Close the other menu
  const menu2 = (ID === "Menu") ? document.getElementById("deleteMenu") : document.getElementById("Menu");
  menu2.style.display = "none";

  // Toggle the clicked menu
  const menu = document.getElementById(ID);
  if (close) {
    menu.style.display = "none";
  } else {
    // Manually center the menu when showing it
    menu.style.position = "fixed";
    menu.style.top = "50%";
    menu.style.left = "50%";
    menu.style.transform = "translate(-50%, -50%)";

    menu.style.display = "block"; // Show the menu
  }
}

function setMenu(type, ip, name) {

    const submit = document.getElementById("submit");

    const ipElement = document.getElementById("IP Address");
    const nameElement = document.getElementById("Name");
    ipElement.value = "";
    nameElement.value = "";
    document.getElementById("invalid-input").style.display = "none";
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

    toggleMenu("Menu")
}

function deleteRow(ip, name) {
    const confirmationPopup = document.getElementById('deleteMenu');
    const title = document.getElementById("deleteH1");
    title.textContent = `Name: ${name} \n IP: ${ip}`
    toggleMenu("deleteMenu");

    const confirmDeleteButton = document.getElementById('confirmDelete');
    confirmDeleteButton.onclick = function() {
      const formData = {
        ip: ip
      };

      fetch(`${url}/api/delete`, {
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
        errorText("Error deleting the row.\n Please try again.");
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

async function userCheck(event) {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
      const response = await fetch(`${url}/api/login`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ username, password }),
          credentials: "include"
      });

      const data = await response.json();

      if (data && data.username) {
          window.location.href = `${url}/admin`;
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
  toggleMenu(formID, true);
}

function add(event){
  event.preventDefault();
  const ip = document.getElementById("IP Address").value;
  const name = document.getElementById("Name").value;

  if (!isValidIp(ip)){
    errorText("Please enter a valid IP address");
    return;
  }

  if (!ip || !name) {
    errorText("Please fill out all fields.");
    return;
  }

  const formData = {
    ip: ip,
    name: name
  };

  fetch(`${url}/api/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(async data => {
    if (!data?.error){
      alert("Added Successfully!");
      update("Menu");
    } else { errorText('IP and name must be unique');}
  })
  .catch(error => {
    console.error('Error during form submission:', error);
    errorText("Error submitting the form.\n Please try again.");
  });
}

function dragable(menuID){
  const el = document.getElementById(menuID);
  const handle = el.querySelector("#drag-handle");
  let offsetX, offsetY;

  handle.style.cursor = "move";
  handle.onmousedown = e => {
    e.preventDefault();
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;

    const move = e => {
      el.style.position = "absolute";
      el.style.left = `${e.clientX - offsetX}px`;
      el.style.top = `${e.clientY - offsetY}px`;
      el.style.zIndex = 9999;
    };

    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
}

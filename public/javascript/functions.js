// Get the current origin (protocol + domain + port) of the page
const url = window.location.origin;
// Variable to store the user's IP
let userIP = "";

// Immediately Invoked Function Expression (IIFE) to fetch user IP address
(async () => {
  try {
    // Make an API call to get the user's IP address
    const res = await fetch(`${url}/api/getIP`);
    // If the request is forbidden (403), stop the execution
    if (res.status === 403){ return; }
    // Parse the JSON response and store the IP in the variable
    userIP = (await res.json()).ip;
  } catch (err) {
    // Log an error if the request fails
    console.error("Failed to fetch user IP:", err);
  }
})();

async function isHost(ip){
    try {
    // Make an API call to get the host's IP address
    const res = await fetch(`${url}/api/isHost`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({userIP: ip})
    });
    // If the request is forbidden (403), stop the execution
    if (res.status === 403){ return; }
    // Parse the JSON response and store the IP in the variable
    return await res.json();
  } catch (err) {
    // Log an error if the request fails
    console.error("Failed to fetch host IP:", err);
  }
}

// Function to validate if an input is a valid IPv4 address
// It uses a regex pattern to check if the input matches a valid IPv4 address format
function isValidIp(ip) {
  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);
}

// Function to display an error message in the UI (by default, in the "invalid-input" element)
function errorText(text, id = "invalid-input") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.display = "block"; // Make the error message visible
}

// Function to load all devices data from the server
async function loadDeviceData() {
  try {
    const res = await fetch(`${url}/api/getAll`);

    // If the user is not authorized or forbidden, redirect to blocked page
    if (res.status === 403){return showBlocked();}

    // If the response is not OK, throw an error
    if (!res.ok) throw new Error("Server error");

    // Parse the response as JSON to get the devices data
    const devices = await res.json()

    const tbody = document.querySelector("tbody");
    // Populate the table with the devices data
    tbody.innerHTML = devices.map(row => `
      <tr>
        <td>${row.ip}</td>
        <td>${row.name}</td>
        <td style="white-space: nowrap;">
          <button id="edit ${row.ip}" class="green-btn" onclick="setMenu('edit', '${row.ip}', '${row.name}', ${row.id})">Edit</button>
          <button id="add ${row.ip}" class="red-btn" onclick="deleteRow('${row.ip}', '${row.name}')">Delete</button>
        </td>
      </tr>`).join("");

      filterTable();

    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = false);
    const title = document.getElementById("title");
    title.textContent = "Devices";
    title.className = "";

  } catch {
    // If an error occurs, display an offline message and disable buttons
    const title = document.getElementById("title");
    title.className = "closed";
    title.textContent = "The Server Is Offline";
    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = true);
  }
}

// Function to filter the table based on the search input
function filterTable() {
  const input = document.getElementById("search-bar").value.toLowerCase();
  document.querySelectorAll("#table-body tr").forEach(row => {
    const [ip, name] = [row.cells[0].textContent, row.cells[1].textContent].map(t => t.toLowerCase());
    // Show or hide rows based on the search input matching IP or Name
    row.style.display = ip.includes(input) || name.includes(input) ? "" : "none";
  });
}

let successTimeout;
function showSuccessMessage(message) {
  const msg = document.getElementById("success-message");

  msg.style.visibility = "visible";
  msg.textContent = message;

  // Clear the previous timeout, if any
  if (successTimeout) {
    clearTimeout(successTimeout);
  }

  // Set a new timeout to hide the message after 5 seconds
  successTimeout = setTimeout(() => {
    msg.style.visibility = "hidden";
    successTimeout = null; // optional: clear the reference
  }, 5000);
}

// Function to submit a form (add, edit, or delete device data)
async function submitForm(request, method, body, successMessage) {
  try {
    const res = await fetch(`${url}/api/${request}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    // Handle session expiry or IP block
    if (res.status === 403 && data.redirect){return showBlocked();}
    // If no error in the response, show success message and reload device data
    if (!data?.error) {
      showSuccessMessage(successMessage);
      loadDeviceData();
      toggleMenu("Menu", true);
    } else {
      // Show error if IP and name are not unique
      errorText('IP and name must be unique');
    }
  } catch (err) {
    console.error(`Error during ${method} to ${request}:`, err);
    // Show error if form submission fails
    errorText(`Error submitting the form.\n Please try again.`);
  }
}

// Function to handle editing a device
function edit(e) {
  e.preventDefault();
  const ipEl = document.getElementById("IP Address");
  const nameEl = document.getElementById("Name");
  const ip = ipEl.value || ipEl.placeholder;
  const name = nameEl.value || nameEl.placeholder;
  const oldIP  = ipEl.placeholder;
  const oldName = nameEl.placeholder;
  const id = document.getElementById("menuId").value;
  // Check if at least one field is filled and if the IP is valid
  if (!ip && !name) return errorText("Please fill out at least one field\n (IP Address or Name).");
  if (!isValidIp(ip)) return errorText("Please enter a valid IP address");
  submitForm("edit", "PUT", { id, ip, name, oldIP, oldName }, "Edited Successfully!");
}

// Function to handle adding a device
function add(e) {
  e.preventDefault();
  const ip = document.getElementById("IP Address").value;
  const name = document.getElementById("Name").value;
  // Check if both fields are filled and if the IP is valid
  if (!ip || !name) return errorText("Please fill out all fields.");
  if (!isValidIp(ip)) return errorText("Please enter a valid IP address");
  submitForm("add", "POST", { ip, name }, "Added Successfully!");
}

// Function to handle deleting a device
function deleteRow(ip, name) {
  document.getElementById("deleteH1").textContent = `Name: ${name} \n IP: ${ip}`;
  toggleMenu("deleteMenu");
  // On confirmation, call submitForm to delete the device
  document.getElementById('confirmDelete').onclick = () => {
    submitForm("delete", "DELETE", { ip, name }, "Deleted Successfully!");
    document.getElementById('deleteMenu').style.display = 'none';
  };
}

// Function to set up the menu for editing or adding a device
function setMenu(menuType, ip, name, id) {
  const ipEl = document.getElementById("IP Address");
  const nameEl = document.getElementById("Name");
  ipEl.value = nameEl.value = "";
  ipEl.placeholder = ip || "";
  nameEl.placeholder = name || "";
  document.getElementById("menuId").value = id || "";
  document.getElementById("invalid-input").style.display = "none";
  document.getElementById("MenuH2").textContent = menuType === "edit" ? "Edit Menu" : "Add Menu";
  document.getElementById("submit").onclick = menuType === "edit" ? edit : add;
  toggleMenu("Menu");
}

// Function to toggle between menu visibility
function toggleMenu(id, close = false) {
  const menu = document.getElementById(id);
  const other = document.getElementById(id === "Menu" ? "deleteMenu" : "Menu");
  other.style.display = "none";
  menu.style.display = close ? "none" : "block";
  if (!close) {
    Object.assign(menu.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)"
    });
  }
}

// Function to make a menu draggable
function dragable(menuID) {
  const el = document.getElementById(menuID);
  const handle = el.querySelector("#drag-handle");
  handle.style.cursor = "move";
  handle.onmousedown = e => {
    const offsetX = e.clientX - el.offsetLeft;
    const offsetY = e.clientY - el.offsetTop;
    const move = e => {
      Object.assign(el.style, {
        position: "absolute",
        left: `${e.clientX - offsetX}px`,
        top: `${e.clientY - offsetY}px`,
        zIndex: 9999
      });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
}

// Function to fetch and display client data
async function fetchClients() {
  try {
    const res = await fetch(`${url}/api/clients`);
    const clients = await res.json();

    if (res.status === 403 && clients.redirect){showBlocked();}

    // Build clients table rows as a single HTML string
    const clientRows = clients.map(client => {
      const date = new Date(client[1]);
      const options = {
        timeZone: 'Asia/Jerusalem',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      const time = date.toLocaleString('en-GB', options);
      return `<tr><td>${client[0]}</td><td>${time}</td></tr>`;
    }).join("");

    // Update the clients table all at once
    const tableBody = document.getElementById('clients-table-body');
    tableBody.innerHTML = clientRows;

    // Fetch whitelist
    const response = await fetch(`${url}/api/getWhitelistAll`);
    const whitelist = await response.json();

    if (res.status === 403 && whitelist.redirect) {showBlocked();}

    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = false);

    // Build whitelist table rows using Promise.all to handle async host check
    const whitelistRows = await Promise.all(
      whitelist.map(async row => {
        const host = await isHost(row.ip);
        const disableReason = host
          ? "Cannot remove hosting PC"
          : row.ip === userIP
          ? "Cannot remove your own IP"
          : "";
        const disabledAttr = (row.ip === userIP || host)
          ? `disabled title="${disableReason}"`
          : "";

        return `
          <tr>
            <td>${row.ip}</td>
            <td>${row.name}</td>
            <td>
              <button id="whitelist ${row.ip}" class="red-btn" ${disabledAttr}
                onclick="removeWhitelistMenu('${row.ip}', '${row.name}')">
                Remove
              </button>
            </td>
          </tr>`;
      })
    );

    // Update the whitelist table all at once
    const tBody = document.getElementById('whitelist-table-body');
    tBody.innerHTML = whitelistRows.join("");

    const title = document.getElementById("title");
    title.textContent = "Connected Clients";
    title.className = "";

  } catch (err) {
    console.error("Failed to fetch clients:", err);
    const title = document.getElementById("title");
    title.textContent = "The Server is offline";
    title.className = "closed";
    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = true);
  }
}

async function removeWhitelistMenu(clientIp, name) {
  if (clientIp === userIP) {
    alert("You can't remove yourself.");
    return;
  }

  const menu = document.getElementById("removeWhitelistMenu");
  const title = document.getElementById("removeWhitelistH1");
  const confirmButton = document.getElementById("confirmRemoveWhitelist");

  // Set menu title and button text based on the action type
  title.textContent = `Remove IP: ${clientIp}`;

  if (menu.style.display !== "" && menu.style.display === "block"){
    menu.style.display = "none";
    return;
  } else {
    // Show the menu centered
    menu.style.display = "block";
    menu.style.position = "fixed";
    menu.style.top = "50%";
    menu.style.left = "50%";
    menu.style.transform = "translate(-50%, -50%)";
  }

  // Set the confirm button handler
  confirmButton.onclick = async function () {

    try {
      const res = await fetch(`${url}/api/whitelist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isWhitelisted: true, clientIp, name }),
      });

    if (res.status === 403){showBlocked();}
      showSuccessMessage(`IP was removed successfully`);

      // Reload the client list
      await fetchClients();
      // Hide the block menu after action
      menu.style.display = "none";

    } catch (err) {
      console.error(`Failed to remove IP:`, err);
      alert(`Failed to remove IP. Please try again.`);
    }
  };
}

function addWhitelistMenu(){
  const menu = document.getElementById("addWhitelistMenu");
  if (menu.style.display !== "" && menu.style.display === "block"){
    menu.style.display = "none";
    return;
  } else {
    document.getElementById("IP Address").value = "";
    document.getElementById("Name").value = "";

    document.getElementById("invalid-input").style.display = "none";

    // Show the menu centered
    menu.style.display = "block";
    menu.style.position = "fixed";
    menu.style.top = "50%";
    menu.style.left = "50%";
    menu.style.transform = "translate(-50%, -50%)";
  }

  document.getElementById("submit").onclick = async (event) => {
    event.preventDefault();
    const clientIp = document.getElementById("IP Address").value;
    const name = document.getElementById("Name").value;
    // Check if both fields are filled and if the IP is valid
    if (!clientIp || !name) return errorText("Please fill out all fields.");
    if (!isValidIp(clientIp)) return errorText("Please enter a valid IP address");

    try {
    const res = await fetch(`${url}/api/whitelist`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isWhitelisted: false, clientIp, name })
    });
    // Handle session expiry or IP block
    switch (res.status){
      case 403: {
        return showBlocked();
      }
      case 409: {
        return errorText("IP and name must be unique");
      }
    }
    const data = await res.json();
    // If no error in the response, show success message and reload clients data data
    if (!data?.error) {
      showSuccessMessage("IP was successfully added to the whitelist");
      fetchClients();
      addWhitelistMenu();
    } else {
      // Show error if IP and name are not unique
      errorText(data.error);
    }
    } catch (err) {
      console.error(`Error adding ${clientIp} to the whitelist:`, err);
      // Show error if form submission fails
      errorText(`Error submitting the form.\n Please try again.`);
    }
  };
}

function showBlocked() {
    // If an error occurs, display an offline message and disable buttons
    const title = document.getElementById("title");
    title.className = "closed";
    title.textContent = "You are not authorized!";
    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = true);
    document.querySelectorAll("tbody").forEach(tbody => {tbody.innerHTML = "";});
    document.querySelectorAll("h1").forEach(h1 => {if (h1.id !== "title")h1.textContent = "";})
}


// Function to load all logs data from the server
async function loadLogs() {
  try {
    const res = await fetch(`${url}/api/getLogs`);

    // If the user is not authorized or forbidden, redirect to blocked page
    if (res.status === 403){return showBlocked();}

    // If the response is not OK, throw an error
    if (!res.ok) throw new Error("Server error");

    // Parse the response as JSON to get the logs data
    const logs = await res.json();

    const tbody = document.querySelector("tbody");
    // Populate the table with the devices data
    tbody.innerHTML = logs.map(row => `
      <tr>
        <td>${row.type === "null" ? "" : row.type}</td>
        <td>${msToString(row.time)}</td>
        <td>${row.clientIP === "null" ? "" : row.clientIP}</td>
        <td>${row.ip === "null" ? "" : row.ip}</td>
        <td>${row.name === "null" ? "" : row.name}</td>
        <td>${row.newIP === "null" ? "" : row.newIP || ""}</td>
        <td>${row.newName === "null" ? "" : row.newName || ""}</td>
      </tr>`).join("");

      filterLogs();

    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = false);
    const title = document.getElementById("title");
    title.textContent = "Logs";
    title.className = "";

  } catch(err) {
    // If an error occurs, display an offline message and disable buttons
    const title = document.getElementById("title");
    title.className = "closed";
    title.textContent = "The Server Is Offline";
    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = true);
  }
}

function msToString(ms) {
  const dateString = new Date(ms).toLocaleString('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  // Replace commas (if any) with an empty string
  return dateString.replace(',', '');
}

// Function to filter the logs table based on the search input
function filterLogs() {
  const input = document.getElementById("search-bar").value.toLowerCase();
  document.querySelectorAll("#table-body tr").forEach(row => {
    const matchFound = Array.from(row.cells).some(cell =>
      cell.textContent.toLowerCase().includes(input)
    );
    row.style.display = matchFound ? "" : "none";
  });
}


// Event listener to handle different pages once the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  switch (window.location.pathname){
    case "/":
    case "/devices": {
      // Load device data
      loadDeviceData();
      setInterval(() => {loadDeviceData();}, 5000);

      // Enable draggable menus
      dragable("Menu");
      dragable("deleteMenu");
      break;
    }
    case "/clients": {
      // Load client data
      fetchClients();
      setInterval(() => {fetchClients();}, 5000);

      // Enable draggable menus
      dragable("removeWhitelistMenu");
      break;
    }
    case "/logs": {
      //Load logs
      loadLogs();
      setInterval(() => {loadLogs();}, 5000);
      break;
    }
  }
});

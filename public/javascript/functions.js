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

// Set the session timeout duration (10 minutes)
const sessionTimeoutDuration = 1000 * 60 * 10;
let sessionTimeout;

// Resets the session timeout, clearing any previous timeout and setting a new one
function resetSessionTimeout() {
  clearTimeout(sessionTimeout); // Clear previous timeout
  sessionTimeout = setTimeout(() => window.location.href = '/', sessionTimeoutDuration); // Redirect after timeout
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

// Function to load all switches data from the server
async function loadSwitchData() {
  try {
    const res = await fetch(`${url}/api/getAll`);
    // If the user is not authorized or forbidden, redirect to login page
    switch (res.status){
      case 401: {
        sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
        window.location.href = '/';
        return;
      }
      case 403: {
        sessionStorage.setItem("errorMessage", "Your IP is blocked");
        window.location.href = '/';
        return;
      }
      case 409: {
        sessionStorage.setItem("errorMessage", "User already logged in on another device");
        window.location.href = '/';
        return;
      }
    }
    // If the response is not OK, throw an error
    if (!res.ok) throw new Error("Server error");

    // Parse the response as JSON to get the switches data
    const switches = await res.json();
    const tbody = document.querySelector("tbody");
    // Populate the table with the switches data
    tbody.innerHTML = switches.map(row => `
      <tr>
        <td>${row.ip}</td>
        <td>${row.name}</td>
        <td style="white-space: nowrap;">
          <button id="edit ${row.ip}" class="green-btn" onclick="setMenu('edit', '${row.ip}', '${row.name}', ${row.id})">Edit</button>
          <button id="add ${row.ip}" class="red-btn" onclick="deleteRow('${row.ip}', '${row.name}')">Delete</button>
        </td>
      </tr>`).join("");

    // Set a timeout to reload switch data and filter the table every 30 seconds
    setTimeout(() => loadSwitchData().then(filterTable), 30_000);
  } catch {
    // If an error occurs, display an offline message and disable buttons
    const title = document.getElementById("title");
    title.className = "closed";
    title.textContent = "The Server Is Offline";
    document.querySelectorAll("button:not(.cancel-btn)").forEach(btn => btn.disabled = true);
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

// Function to submit a form (add, edit, or delete switch data)
async function submitForm(request, method, body, successMessage) {
  try {
    const res = await fetch(`${url}/api/${request}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    // Handle session expiry or IP block
    switch (res.status){
      case 401: {
        sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
        window.location.href = '/';
        return;
      }
      case 403: {
        sessionStorage.setItem("errorMessage", "Your IP is blocked");
        window.location.href = '/';
        return;
      }
      case 409: {
        sessionStorage.setItem("errorMessage", "User already logged in on another device");
        window.location.href = '/';
        return;
      }
    }
    const data = await res.json();
    // If no error in the response, show success message and reload switch data
    if (!data?.error) {
      alert(successMessage);
      loadSwitchData().then(filterTable);
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

// Function to handle editing a switch
function edit(e) {
  e.preventDefault();
  const ipEl = document.getElementById("IP Address");
  const nameEl = document.getElementById("Name");
  const ip = ipEl.value || ipEl.placeholder;
  const name = nameEl.value || nameEl.placeholder;
  const id = document.getElementById("menuId").value;
  // Check if at least one field is filled and if the IP is valid
  if (!ip && !name) return errorText("Please fill out at least one field\n (IP Address or Name).");
  if (!isValidIp(ip)) return errorText("Please enter a valid IP address");
  submitForm("edit", "PUT", { id, ip, name }, "Edited Successfully!");
}

// Function to handle adding a switch
function add(e) {
  e.preventDefault();
  const ip = document.getElementById("IP Address").value;
  const name = document.getElementById("Name").value;
  // Check if both fields are filled and if the IP is valid
  if (!ip || !name) return errorText("Please fill out all fields.");
  if (!isValidIp(ip)) return errorText("Please enter a valid IP address");
  submitForm("add", "POST", { ip, name }, "Added Successfully!");
}

// Function to handle deleting a switch
function deleteRow(ip, name) {
  document.getElementById("deleteH1").textContent = `Name: ${name} \n IP: ${ip}`;
  toggleMenu("deleteMenu");
  // On confirmation, call submitForm to delete the switch
  document.getElementById('confirmDelete').onclick = () => {
    submitForm("delete", "DELETE", { ip }, "Deleted Successfully!");
    document.getElementById('deleteMenu').style.display = 'none';
  };
}

// Function to set up the menu for editing or adding a switch
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

// Function to check user credentials during login
async function userCheck(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  try {
    // Send login request
    const res = await fetch(`${url}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
    if (res.status === 403) {return errorText("your IP is blocked", "error-message");}
    else if (res.status === 409) {return errorText("User already logged in on another device", "error-message");}
    window.location.href = `/switches`
  } catch {
    document.getElementById("error-message").textContent = "Server error. Try again.";
    document.getElementById("error-message").style.display = "block";
  }
}
// Function to fetch and display client data
async function fetchClients() {
  try {
    const res = await fetch(`${url}/api/clients`);

    // Handle session expiry or IP block
    switch (res.status){
      case 401: {
        sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
        window.location.href = '/';
        return;
      }
      case 403: {
        sessionStorage.setItem("errorMessage", "Your IP is blocked");
        window.location.href = '/';
        return;
      }
      case 409: {
        sessionStorage.setItem("errorMessage", "User already logged in on another device");
        window.location.href = '/';
        return;
      }
    }

    // Parse the response and display the clients in a table
    const clients = await res.json();
    const tableBody = document.getElementById('clients-table-body');
    tableBody.innerHTML = '';

    clients.forEach(client => {
      const tr = document.createElement("tr");

      const isDisable = client === userIP || client === "127.0.0.1";
      const disableReason = client === userIP ? "Cannot block your own IP" : client === "127.0.0.1" ? "Cannot block hosting PC" : "";

      tr.innerHTML = `
        <td>${client}</td>
        <td>
          <button id="block ${client}" class="red-btn" ${isDisable ? "disabled title='" + disableReason + "'" : ""}
            onclick="toggleBlockMenu('block', '${client}')">
            Block
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    const response = await fetch(`${url}/api/getBlockedAll`);
    // Handle session expiry or IP block
    switch (res.status){
      case 401: {
        sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
        window.location.href = '/';
        return;
      }
      case 403: {
        sessionStorage.setItem("errorMessage", "Your IP is blocked");
        window.location.href = '/';
        return;
      }
      case 409: {
        sessionStorage.setItem("errorMessage", "User already logged in on another device");
        window.location.href = '/';
        return;
      }
    }
    const blockedList = await response.json();
    const tBody = document.getElementById('blocked-table-body');
    tBody.innerHTML = '';

    blockedList.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.ip}</td>
        <td>
          <button id="unblock ${row.ip}" class="green-btn"
            onclick="toggleBlockMenu('unblock', '${row.ip}')">
            Unblock
          </button>
        </td>
      `;
      tBody.appendChild(tr);
    })
    setTimeout(() => fetchClients(), 30_000); // Reload every 30s

  } catch (err) {
    console.error("Failed to fetch clients:", err);
    const title = document.getElementById("title");
    title.textContent = "The Server is offline";
    title.className = "closed";
    document.querySelectorAll("button:not(.cancel-btn)").forEach(btn => btn.disabled = true);
  }

}

async function toggleBlockMenu(type, clientIp, name) {
  if (clientIp === userIP) {
    alert("You cannot block yourself.");
    return;
  }

  const menu = document.getElementById("blockMenu");
  const title = document.getElementById("blockH1");
  const confirmButton = document.getElementById("confirmBlock");
  const desc = document.getElementById("blockDesc");

  // Set menu title and button text based on the action type
  title.textContent = `${type === "block" ? "Block" : "Unblock"} IP: ${clientIp}`;
  confirmButton.textContent = type === "block" ? "Confirm Block" : "Confirm Unblock";
  desc.textContent = type === "block" ? "Are you sure you want to block this IP?" : "Are you sure you want to unblock this IP?"

  // Show the menu centered
  menu.style.display = "block";
  menu.style.position = "fixed";
  menu.style.top = "50%";
  menu.style.left = "50%";
  menu.style.transform = "translate(-50%, -50%)";

  // Set the confirm button handler
  confirmButton.onclick = async function () {
    const isBlocked = type === "unblock"; // We're unblocking if type is "unblock"

    try {
      const response = await fetch(`${url}/api/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isBlocked, clientIp }),
      });

    switch (res.status){
      case 401: {
        sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
        window.location.href = '/';
        return;
      }
      case 403: {
        sessionStorage.setItem("errorMessage", "Your IP is blocked");
        window.location.href = '/';
        return;
      }
      case 409: {
        sessionStorage.setItem("errorMessage", "User already logged in on another device");
        window.location.href = '/';
        return;
      }
    }
      alert(`ip was ${type}ed successfully`);

      // Reload the client list
      await fetchClients();
      // Hide the block menu after action
      menu.style.display = "none";

    } catch (err) {
      console.error(`Failed to ${type} IP:`, err);
      alert(`Failed to ${type} IP. Please try again.`);
    }
  };
}


// Event listener to handle different pages once the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  switch (window.location.pathname){
    case "/": {
      const sessionError = sessionStorage.getItem("errorMessage");
      if (sessionError) {
        errorText(sessionError, "error-message");
        sessionStorage.removeItem("errorMessage");
      }
      break;
    }
    case "/switches": {
      // Load switch data
      loadSwitchData();

      // Enable draggable menus
      dragable("Menu");
      dragable("deleteMenu");
      break;
    }
    case "/clients": {
      fetchClients();
    }
  }
});

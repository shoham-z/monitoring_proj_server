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

    // If the response is not OK, throw an error
    if (!res.ok) throw new Error("Server error");

    // Parse the response as JSON to get the switches data
    const switches = await res.json();

    // If the user is not authorized or forbidden, redirect to blocked page
    if (res.status === 403 && switches.redirect){return window.location.href = switches.redirect;}

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

// Function to submit a form (add, edit, or delete switch data)
async function submitForm(request, method, body, successMessage) {
  try {
    const res = await fetch(`${url}/api/${request}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    // Handle session expiry or IP block
    if (res.status === 403 && data.redirect){return window.location.href = data.redirect;}
    // If no error in the response, show success message and reload switch data
    if (!data?.error) {
      showSuccessMessage(successMessage);
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

// Function to fetch and display client data
async function fetchClients() {
  try {
    const res = await fetch(`${url}/api/clients`);

    // Parse the response and display the clients in a table
    const clients = await res.json();

    // Handle session expiry or IP block
  if (res.status === 403 && clients.redirect){return window.location.href = clients.redirect;}

    const tableBody = document.getElementById('clients-table-body');
    tableBody.innerHTML = '';

    clients.forEach(client => {
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
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${client[0]}</td>
        <td>${time}</td>
      `;
      tableBody.appendChild(tr);
    });

    const response = await fetch(`${url}/api/getWhitelistAll`);
    const whitelist = await response.json();
    // Handle session expiry or IP whitelist
    if (res.status === 403 && whitelist.redirect){return window.location.href = whitelist.redirect;}
    const tBody = document.getElementById('whitelist-table-body');
    tBody.innerHTML = '';

    whitelist.forEach(row => {
      const isDisable = row.ip === userIP || row.ip === "127.0.0.1";
      const disableReason = row.ip === userIP ? "Cannot remove your own IP" : row.ip === "127.0.0.1" ? "Cannot remove hosting PC" : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.ip}</td>
        <td>${row.name}</td>
        <td>
          <button id="whitelist ${row.ip}" class="red-btn" ${isDisable ? "disabled title='" + disableReason + "'" : ""}
            onclick="removeWhitelistMenu('${row.ip}')">
            Remove
          </button>
        </td>
      `;
      tBody.appendChild(tr);
    })
  } catch (err) {
    console.error("Failed to fetch clients:", err);
    const title = document.getElementById("title");
    title.textContent = "The Server is offline";
    title.className = "closed";
    document.querySelectorAll("button:not(.cancel-btn)").forEach(btn => btn.disabled = true);
  }

}

async function removeWhitelistMenu(clientIp, name) {
  if (clientIp === userIP) {
    alert("You can't remove yourself.");
    return;
  } else if (clientIp === "127.0.0.1"){
    alert("You can't remove hosting pc");
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
        body: JSON.stringify({ isWhitelisted: true, clientIp }),
      });

    if (res.status === 403)
      {
        const data = res.json();
        if (data.redirect){
          return window.location.href = data.redirect;
        }
      }
      showSuccessMessage(`ip was removed successfully`);

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
        const data = res.json();
        if (data.redirect){
          return window.location.href = data.redirect;
        }
      }
      case 409: {
        return errorText("IP and name must be unique");
      }
    }
    const data = await res.json();
    // If no error in the response, show success message and reload switch data
    if (!data?.error) {
      showSuccessMessage("Ip was successfully added to the whitelist");
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


// Event listener to handle different pages once the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  switch (window.location.pathname){
    case "/":
    case "/switches": {
      // Load switch data
      loadSwitchData();
      setInterval(() => {loadSwitchData();}, 5000);

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
  }
});

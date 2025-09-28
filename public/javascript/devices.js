// Get the current origin (protocol + domain + port) of the page
const url = window.location.origin;

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
  const rows = document.querySelectorAll("#table-body tr");

  let visibleIndex = 1; // only count visible rows
  rows.forEach(row => {
    const [ip, name] = [row.cells[0].textContent, row.cells[1].textContent].map(t => t.toLowerCase());
    const match = ip.includes(input) || name.includes(input);

    row.style.display = match ? "" : "none";

    // Reset classes first
    row.classList.remove("even", "odd");

    if (match) {
      row.classList.add(visibleIndex % 2 === 0 ? "even" : "odd");
      visibleIndex++;
    }
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

document.addEventListener("DOMContentLoaded", function () {
  loadDeviceData();
  setInterval(() => {loadDeviceData();}, 5000);
  dragable("Menu");
  dragable("deleteMenu");
})
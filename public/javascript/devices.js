// Get the current origin (protocol + domain + port) of the page
const url = window.location.origin;

/**
 * Function to load all devices data into the table
 */
async function loadDeviceData() {
  try {
    const res = await fetch(`${url}/api/getAll`);

    // If the user is not authorized or forbidden, redirect to blocked page
    if (res.status === 403) return showBlocked();

    // If the response is not OK, throw an error
    if (!res.ok) throw new Error("Server error");

    // Parse the response as JSON to get the devices data
    const devices = await res.json();

    const tbody = document.querySelector("tbody");

    // Populate the table with the devices data
    tbody.innerHTML = devices.map((row) => `
      <tr>
        <td>${row.ip}</td>
        <td>${row.name}</td>
        <td style="white-space: nowrap;">
          <button id="edit ${row.ip}" class="green-btn"
            onclick='setMenu("edit", ${JSON.stringify(row.ip)}, ${JSON.stringify(row.name)}, ${row.id})'>
            Edit
          </button>
          <button id="add ${row.ip}" class="red-btn" 
            onclick='deleteRow(${JSON.stringify(row.ip)}, ${JSON.stringify(row.name)})'>
            Delete
          </button>
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

/**
 * Function to filter the table based on the search input
 */
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
      row.classList.add((visibleIndex+1) % 2 === 0 ? "even" : "odd");
      visibleIndex++;
    }
  });
}

/**
 * Submits a form request to the server for adding, editing, or deleting a device.
 * @param {string} request - The API endpoint name (e.g., "add", "edit", "delete").
 * @param {string} method - The HTTP method to use (e.g., "POST", "PUT", "DELETE").
 * @param {Object} body - The request payload to send to the server.
 * @param {string} message - The success message to display after completion.
 */
async function submitForm(request, method, body, message) {
  try {
    const res = await fetch(`${url}/api/${request}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    switch (res.status){
      case 403: return showBlocked(); // Handle unwhitelisted ip
      case 409: return errorText('IP and name must be unique'); // Show error if IP and name are not unique
      case 500: {
        console.error(`Error during ${method} to ${request}:`, data.error);
        // Show error if form submission fails
        return errorText(`Error submitting the form.\n Please try again.`);
      }
    }

    // If no error in the response, show success message and reload device data
    showMessage(message);
    loadDeviceData();
    toggleMenu("Menu", true);
  } catch (err) {
    console.error(`Error during ${method} to ${request}:`, err);
    // Show error if form submission fails
    errorText(`Error submitting the form.\n Please try again.`);
  }
}

/**
 * Handles form submission for editing an existing device.
 * @param {Event} e - The form submit event.
 */
function edit(e) {
  e.preventDefault();
  const ipEl = document.getElementById("IP Address");
  const nameEl = document.getElementById("Name");
  const ip = ipEl.value || ipEl.placeholder;
  const name = nameEl.value || nameEl.placeholder;
  const id = document.getElementById("menuId").value;
  // Check if at least one field is filled and if the IP is valid
  if (!ip && (!name || name.trim() === "")) return errorText("Please fill out at least one field\n (IP Address or Name).");
  if (!isValidIPv4(ip) && ip.trim() !== "") return errorText("Please enter a valid IP address");
  submitForm("edit", "PUT", { id, ip, name }, "Edited Successfully!");
}

/**
 * Handles form submission for adding a new device.
 * @param {Event} e - The form submit event.
 */
function add(e) {
  e.preventDefault();
  const ip = document.getElementById("IP Address").value;
  const name = document.getElementById("Name").value;
  // Check if both fields are filled and if the IP is valid
  if (!ip || !name) return errorText("Please fill out all fields.");
  if (!isValidIPv4(ip)) return errorText("Please enter a valid IP address");
  submitForm("add", "POST", { ip, name }, "Added Successfully!");
}

/**
 * Handles device deletion confirmation and triggers delete API call.
 * @param {string} ip - The IP address of the device to delete.
 * @param {string} name - The name of the device to delete.
 */
function deleteRow(ip, name) {
  document.getElementById("deleteH1").textContent = `Name: ${name} \n IP: ${ip}`;
  toggleMenu("deleteMenu");
  // On confirmation, call submitForm to delete the device
  document.getElementById('confirmDelete').onclick = () => {
    submitForm("delete", "DELETE", { ip }, "Deleted Successfully!");
    document.getElementById('deleteMenu').style.display = 'none';
  };
}

/**
 * Configures and displays the menu for editing or adding a device.
 * @param {string} menuType - The type of menu ("edit" or "add").
 * @param {string} [ip] - The IP address to display as a placeholder (for editing).
 * @param {string} [name] - The device name to display as a placeholder (for editing).
 * @param {string} [id] - The ID of the device being edited.
 */
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

/**
 * Toggles the visibility of a given menu element.
 * @param {string} id - The ID of the menu element to toggle ("Menu" or "deleteMenu").
 * @param {boolean} [close=false] - Whether to force-close the menu.
 */
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

/**
 * Initializes the page once the DOM has fully loaded.
 * Loads device data, sets up periodic refresh, and makes menus draggable.
 */
document.addEventListener("DOMContentLoaded", function () {
  loadDeviceData();
  setInterval(() => {loadDeviceData();}, 5000);
  dragable("Menu");
  dragable("deleteMenu");
})
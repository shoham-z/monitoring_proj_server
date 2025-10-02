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

// Function to fetch and display client data
async function fetchClients() {
  try {
    const res = await fetch(`${url}/api/clients`);
    const clients = await res.json();

    if (res.status === 403 && clients.redirect){showBlocked();}

    var isEvenClients = false;
    var finalRowClients = "";

    // Build clients table rows as a single HTML string
    const clientRows = clients.map((client, index) => {
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
      finalRowClients = `<tr class="${index % 2 === 0 ? "even" : "odd"}"><td>${client[0]}</td><td>${time}</td></tr>`;
      isEvenClients = !isEvenClients;
      return finalRowClients;
    }).join("");

    // Update the clients table all at once
    const tableBody = document.getElementById('clients-table-body');
    tableBody.innerHTML = clientRows;

    // Fetch whitelist
    const response = await fetch(`${url}/api/getWhitelistAll`);
    const whitelist = await response.json();

    if (res.status === 403 && whitelist.redirect) {showBlocked();}

    document.querySelectorAll("button:not(.gray-btn):not([id*='whitelist'])").forEach(btn => btn.disabled = false);

    // Build whitelist table rows using Promise.all to handle async host check
    const whitelistRows = await Promise.all(
      whitelist.map(async (row, index) => { // use index
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
          <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
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

document.addEventListener("DOMContentLoaded", function () {
    // Load client data
    fetchClients();
    setInterval(() => {fetchClients();}, 5000);

    // Enable draggable menus
    dragable("removeWhitelistMenu");
    dragable("addWhitelistMenu");
});
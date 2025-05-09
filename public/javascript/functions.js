const url = window.location.origin;
let userIP = "";
async function fetchUserIP() {
  try {
    const res = await fetch(`${url}/api/getIP`);
    const data = await res.json();
    return data.ip; // ✅ Return the IP
  } catch (err) {
    console.error("Failed to fetch user IP:", err);
    return null; // Return something to avoid undefined crashes
  }
}
fetchUserIP().then(ip => {
  userIP = ip;
  console.log("User IP after fetch:", userIP);
});

// Session timeout duration (10 minutes)
const sessionTimeoutDuration =  1000 * 60 * 10; // 10 minutes in milliseconds
let sessionTimeout;

async function loadSwitchData() {
  try {
      const response = await fetch(`${url}/api/getAll`);

      if (response.status === 401) {
        // Session expired
        sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
        window.location.href = '/'; // Redirect to login page
        return;
      } else if (response.status === 403){
        sessionStorage.setItem("errorMessage", "Your IP is blocked");
        window.location.href = '/'; // Redirect to login page
        return;
      }
  
      if (!response.ok) {throw new Error("Server error");}

      const switches = await response.json();

      const tableBody = document.querySelector("tbody");
      tableBody.innerHTML = ""; // Clear table

      switches.forEach(row => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
              <td>${row.ip}</td>
              <td>${row.name}</td>
              <td style="white-space: nowrap;">
                  <button id="edit ${row.ip}"class="green-btn" onclick="setMenu('${"edit"}', '${row.ip}', '${row.name}', ${row.id})">Edit</button>
                  <button id="add ${row.ip}"class="red-btn" onclick="deleteRow('${row.ip}', '${row.name}')">Delete</button>
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
  const id = document.getElementById("menuId").value;

  if (!ip && !name) {
    errorText("Please fill out at least one field\n (IP Address or Name).");
    return;
  } else if (!ip && name){
    ip = ipElement.placeholder;
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
    id: id
  };

  fetch(`${url}/api/edit`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData)
  })
  .then(response => {
    if (response.status === 401) {
      // Session expired
      sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
      window.location.href = '/'; // Redirect to login page
      return;
    } else if (response.status === 403){
      sessionStorage.setItem("errorMessage", "Your IP is blocked");
      window.location.href = '/'; // Redirect to login page
      return;
    }
    response.json();
  })
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

function errorText(text, elementID = "invalid-input"){
  const element = document.getElementById(elementID);
  element.textContent = text;
  element.style.display = "block";
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

function setMenu(type, ip, name, id) {

    const submit = document.getElementById("submit");

    const ipElement = document.getElementById("IP Address");
    const nameElement = document.getElementById("Name");
    ipElement.value = "";
    nameElement.value = "";
    document.getElementById("invalid-input").style.display = "none";
    const h2 = document.getElementById("MenuH2");

    if (type === "edit"){
      document.getElementById("menuId").value = id;
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
      .then(response => {
        if (response.status === 401) {
          // Session expired
          sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
          window.location.href = '/'; // Redirect to login page
          return;
        } else if (response.status === 403){
          sessionStorage.setItem("errorMessage", "Your IP is blocked");
          window.location.href = '/'; // Redirect to login page
          return;
        }
        response.json();
      })
      .then(data => {
        alert("Deleted Successfully!");
        loadSwitchData();
        filterTable();
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

      if (response.status === 403){
        errorText("your IP is blocked", "error-message");
        return;
      }

      const data = await response.json();

      if (data && data.username) {
          window.location.href = `${url}/switches`;
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
  .then(response => {
    if (response.status === 401) {
      // Session expired
      sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
      window.location.href = '/'; // Redirect to login page
      return;
    } else if (response.status === 403){
      sessionStorage.setItem("errorMessage", "Your IP is blocked");
      window.location.href = '/'; // Redirect to login page
      return;
    }
    response.json();
  })
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

function toggleBlockMenu(clientIp, name) {
  // ✅ Prevent user from blocking themselves
  if (clientIp === userIP) {
    alert("You cannot block yourself.");
    return;
  }

  const menu = document.getElementById("blockMenu");
  const title = document.getElementById("blockH1");
  title.textContent = `Name: ${name} \n IP: ${clientIp}`;

  menu.style.display = "block";
  menu.style.position = "fixed";
  menu.style.top = "50%";
  menu.style.left = "50%";
  menu.style.transform = "translate(-50%, -50%)";

  const confirmButton = document.getElementById('confirmBlock');
  confirmButton.onclick = async function () {
    const isBlocked = block.has(clientIp);

    try {
      const response = await fetch(`${url}/api/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isBlocked, clientIp }),
      });

      if (response.status === 401) {
        sessionStorage.setItem("errorMessage", "Your session has expired.\nPlease log in again.");
        window.location.href = '/';
        return;
      } else if (response.status === 403) {
        sessionStorage.setItem("errorMessage", "Your IP is blocked.");
        window.location.href = '/';
        return;
      }

      const button = document.getElementById(`block ${clientIp}`);
      if (!isBlocked) {
        button.className = "green-btn";
        button.textContent = "Unblock";
        block.add(clientIp);
      } else {
        button.className = "red-btn";
        button.textContent = "Block";
        block.delete(clientIp);
      }

      menu.style.display = "none";
    } catch (error) {
      console.error("Error during block/unblock request:", error);
      errorText("Error blocking the client.\nPlease try again.");
    }
  };

  document.getElementById("cancelBlock").onclick = function () {
    menu.style.display = "none";
  };
}

async function fetchClients() {
  try {
    const res = await fetch(`${url}/api/clients`);

    if (res.status === 401) {
      sessionStorage.setItem("errorMessage", "Your session has expired.\n Please log in again.");
      window.location.href = '/';
      return;
    } else if (res.status === 403) {
      sessionStorage.setItem("errorMessage", "Your IP is blocked");
      window.location.href = '/';
      return;
    }

    const clients = await res.json();
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';

    clients.forEach(client => {
      const tr = document.createElement("tr");

      const isSelf = client === userIP;

      tr.innerHTML = `
        <td>${client}</td>
        <td>
          <button id="block ${client}" class="red-btn" ${isSelf ? "disabled title='Cannot block yourself'" : `onclick="toggleBlockMenu('${client}')"`}>
            Block
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    setTimeout(fetchClients, 30_000);
  } catch (error) {
    console.error("Error fetching clients:", error);
  }
}


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

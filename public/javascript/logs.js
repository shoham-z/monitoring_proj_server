const url = window.location.origin;
// -- init --
let currentPageDown = 1; // newest logs going down
let currentPageUp = 1;   // page number used when loading up
let loading = false;
let allLoadedDown = false;
// start false — we haven't proven there's nothing above yet
let allLoadedUp = true;
const maxRows = 200;

// -- loadLogs (only relevant parts shown, replace your function with this) --
async function loadLogs(page, direction, search) {
  loading = true;

  try {
    const res = await fetch(`${url}/api/getLogs?page=${page}&search=${search||""}`);
    if (res.status === 403) return showBlocked();
    if (!res.ok) throw new Error("Server error");

    const logs = await res.json();

    // keep your existing "no more down" logic (using length here is fine for down)
    if (direction === "beforeend" && logs.length === 0) {
      allLoadedDown = true;
      return;
    } else {allLoadedDown = false;}

    var isEven = false;

    // insert rows (your current insert logic)
    const tbody = document.querySelector("tbody");
    if (direction === "afterbegin") logs.reverse();
    logs.forEach(row => {
      const tr = `
        <tr class="${isEven ? "even" : "odd"}">
          <td>${row.type}</td>
          <td>${msToString(row.time)}</td>
          <td>${row.clientIP}</td>
          <td>${row.ip}</td>
          <td>${row.name}</td>
          <td>${row.newIP === "null" ? "" : row.newIP || ""}</td>
          <td>${row.newName === "null" ? "" : row.newName || ""}</td>
        </tr>
      `;
      isEven = !isEven;
      tbody.insertAdjacentHTML(direction, tr);
    });

    // update page counters (keep your existing rules if you prefer)
    if (direction === "beforeend") {
      currentPageDown++;
      // when going down, allow going back up
      if (currentPageDown - currentPageUp > maxRows / 100) {
        currentPageUp++;
        allLoadedUp = false;
      }
    } else { // afterbegin
      // NOTE: keep your chosen increment/decrement semantics — this just updates flags
      currentPageUp--;
      if (currentPageDown - currentPageUp > maxRows / 100) { currentPageDown--; }
      if (page <= 1){allLoadedUp = true;}

      const container = document.getElementById("table-container");
      container.scrollTop += 5600;
    }



    trimOverflowRows(direction);

  } catch (err) {
    console.error(err);
  } finally {
    loading = false;
  }
}

function trimOverflowRows(direction) {
  const tbody = document.querySelector("tbody");

  while (tbody.rows.length > maxRows) {
    if (direction === "beforeend") {
      // Loaded more at bottom → remove oldest at top
      tbody.removeChild(tbody.rows[0]);
    } else {
      // Loaded more at top → remove newest at bottom
      tbody.removeChild(tbody.rows[tbody.rows.length - 1]);
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadLogs(1, "beforeend", document.getElementById("search-bar").value.toLowerCase());

  const container = document.getElementById("table-container");
  container.addEventListener("scroll", () => {
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 0;
    const atTop = container.scrollTop <= 0;

    if (atBottom && !loading && !allLoadedDown) {
      loadLogs(currentPageDown, "beforeend", document.getElementById("search-bar").value.toLowerCase());
    } else if (atTop && !loading && !allLoadedUp) {
      loadLogs(currentPageUp, "afterbegin", document.getElementById("search-bar").value.toLowerCase());
    } 
  });
});

var timeout;

function filterLogs() {
  clearTimeout(timeout); // reset timer each keystroke
  timeout = setTimeout(() => {
    const search = document.getElementById("search-bar").value.toLowerCase();

    // reset state for new search
    currentPageDown = 1;
    currentPageUp = 1;
    allLoadedDown = false;
    allLoadedUp = true;

    // clear table
    document.querySelector("tbody").innerHTML = "";

    // load first page with search
    loadLogs(1, "beforeend", search);
  }, 1000); // 1 second
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
  return dateString.replace(',', '<br>');
}

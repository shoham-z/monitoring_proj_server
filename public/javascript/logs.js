const url = window.location.origin;

let currentPageDown = 1; // page number used when loading down
let currentPageUp = 1;   // page number used when loading up
let loading = false; // true if currently loading logs
let allLoadedDown = false;  // true if finished loading all the way down
let allLoadedUp = true; // true if finished loading all the way up
const maxRows = 200; // maximum rows at once (must be devideable by 100)

/**
 * Function to load all logs data from the server
 * @param {number} page - The current page number to load.
 * @param {"beforeend"|"afterbegin"} direction - The direction to insert rows:
 *  - `"beforeend"` loads new logs at the bottom.
 *  - `"afterbegin"` loads older logs at the top.
 * @param {string} [search] - Optional search query to filter logs by.
 */
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

    // Insert rows with consistent alternating colors
    const tbody = document.querySelector("tbody");
    if (direction === "afterbegin") logs.reverse();

    logs.forEach((row, index) => {
      const tr = `
        <tr class="${index % 2 === 0 ? "even" : "odd"}">
          <td>${row.type}</td>
          <td>${msToString(row.time)}</td>
          <td>${row.clientIP}</td>
          <td>${row.ip}</td>
          <td>${row.name}</td>
          <td>${row.newIP === "null" ? "" : row.newIP || ""}</td>
          <td>${row.newName === "null" ? "" : row.newName || ""}</td>
        </tr>
      `;
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



    deleteOverflow(direction);

  } catch (err) {
    console.error(err);
  } finally {
    loading = false;
  }
}

/**
 * Removes extra table rows if the total exceeds the maximum allowed (`maxRows`).
 * Keeps the most recent rows visible and trims from the opposite end.
 * @param {"beforeend"|"afterbegin"} direction - The direction rows will be deleted:
 *  - `"beforeend"` removes rows from the top.
 *  - `"afterbegin"` removes rows from the bottom.
 */
function deleteOverflow(direction) {
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

/**
 * Initialize log table behavior:
 * - Loads the first page of logs on DOM load.
 * - Handles infinite scrolling (loads more logs when reaching top or bottom).
 */
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

var filterTimeout;

/**
 * Filters the log entries based on the search input value.
 * Waits 1 second after the last keystroke before performing the filter,
 * to avoid excessive reloads while typing.
 *
 * Resets pagination and state variables, clears the current table,
 * and loads the first page of logs matching the search term.
 */
function filterLogs() {
  clearTimeout(filterTimeout); // reset timer each keystroke
  filterTimeout = setTimeout(() => {
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

/**
 * Converts a timestamp in milliseconds to a formatted date-time string
 * in the Asia/Jerusalem time zone, with a line break between date and time.
 *
 * Example output: "09/10/2025<br>16:30:45"
 *
 * @param {number} ms - The timestamp in milliseconds.
 * @returns {string} The formatted date-time string with a line break.
 */
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

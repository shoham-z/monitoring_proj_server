/**
 * Function to validate if an input is a valid IPv4 address
 * @param {string} ip An IPv4 address
 * @returns {boolean} true if given a valid IPv4 address
 */
function isValidIPv4(ip) {
  const validFormat = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);
  if (!validFormat) return false;

  // Reject 0.0.0.0 and 255.255.255.255
  if (ip === "0.0.0.0" || ip === "255.255.255.255") return false;

  return true;
}

/**
 * Function to display an error message in the UI (by default, in the "invalid-input" element)
 * @param {string} text - Text to disaplay as error reason
 * @param {string} id - ID of the element the error is dislayed on
 */
function errorText(text, id = "invalid-input") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.display = "block"; // Make the error message visible
}

/**
 * Function to make a menu draggable
 * @param {string} menuID - ID of a div menu to be made dragable
 */
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

/**
 * Functions that makes all of the ui invisible if the user is not whitelisted
 */
function showBlocked() {
    // If an error occurs, display an offline message and disable buttons
    const title = document.getElementById("title");
    title.className = "closed";
    title.textContent = "You are not authorized!";
    document.querySelectorAll("button:not(.gray-btn)").forEach(btn => btn.disabled = true);
    document.querySelectorAll("tbody").forEach(tbody => {tbody.innerHTML = "";});
    document.querySelectorAll("h1").forEach(h1 => {if (h1.id !== "title")h1.textContent = "";})
}

let timeout;
/**
 * Displays a temporary message on screen, optionally styled as an error.
 * The message automatically disappears after 5 seconds.
 * @param {string} message - The text content of the message to display.
 * @param {boolean} [isError=false] - Whether to show the message as an error (true) or success (false).
 */
function showMessage(message, isError = false) {
  const msg = document.getElementById("message");

  msg.className = isError ? "closed" : "success";

  msg.style.visibility = "visible";
  msg.textContent = message;

  // Clear the previous timeout, if any
  if (timeout) {
    clearTimeout(timeout);
  }

  // Set a new timeout to hide the message after 5 seconds
  timeout = setTimeout(() => {
    msg.style.visibility = "hidden";
    timeout = null; // optional: clear the reference
  }, 5000);
}

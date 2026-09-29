/*
 * About Me Website - Client-side JavaScript
 * Cesar Espitia
 *
 * Handles:
 *  - Footer year
 *  - Contact form validation and submission to the server
 *  - Success / error feedback in the UI
 */

/* ---------------- Footer year ---------------- */

document.addEventListener("DOMContentLoaded", function () {
  var yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  var form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", handleContactSubmit);
});

/* ---------------- Contact form ---------------- */

function getSelectedReason() {
  var checked = document.querySelector('input[name="reason"]:checked');
  return checked ? checked.value : null;
}

function validateContactForm(data) {
  var errors = [];

  if (!data.firstName) errors.push("First name is required.");
  if (!data.lastName) errors.push("Last name is required.");
  if (!data.email) {
    errors.push("Email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Please enter a valid email address.");
  }
  if (!data.reason) errors.push("Please choose a reason for contact.");
  if (!data.message) errors.push("Message is required.");

  return errors;
}

function showFormMessage(type, text) {
  var box = document.getElementById("form-message");
  if (!box) return;
  box.textContent = text;
  box.className = "form-message visible " + type;
}

function hideFormMessage() {
  var box = document.getElementById("form-message");
  if (box) box.className = "form-message";
}

function handleContactSubmit(event) {
  event.preventDefault();
  hideFormMessage();

  var form = event.target;

  var data = {
    firstName: form.elements["firstName"].value.trim(),
    lastName: form.elements["lastName"].value.trim(),
    email: form.elements["email"].value.trim(),
    reason: getSelectedReason(),
    message: form.elements["message"].value.trim(),
  };

  // Client-side validation before sending to the server
  var errors = validateContactForm(data);
  if (errors.length > 0) {
    showFormMessage("error", errors.join(" "));
    return;
  }

  var submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then(function (response) {
      return response
        .json()
        .then(function (body) {
          return { ok: response.ok, status: response.status, body: body };
        });
    })
    .then(function (result) {
      if (result.ok) {
        // Success: confirm, clear the form, reset the chosen reason
        showFormMessage(
          "success",
          "Thank you, " +
            data.firstName +
            "! Your message was sent successfully. I will get back to you soon."
        );
        form.reset();
      } else {
        // Server rejected the submission (400 validation, 500 storage)
        showFormMessage(
          "error",
          (result.body && result.body.error) ||
            "Something went wrong. Please try again."
        );
      }
    })
    .catch(function () {
      showFormMessage(
        "error",
        "Could not reach the server. Please check your connection and try again."
      );
    })
    .finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    });
}

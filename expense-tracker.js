import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

var firebaseConfig = {
  apiKey: "AIzaSyAoRMybyh_83sEgcKnF_yUK3_hs4zXWF9c",
  authDomain: "expense-3ddb0.firebaseapp.com",
  projectId: "expense-3ddb0",
  storageBucket: "expense-3ddb0.firebasestorage.app",
  messagingSenderId: "678543474449",
  appId: "1:678543474449:web:9fe7f3c4c4120c6fa496b0"
};

var householdId = "shared-household";

(function () {
  var appPanel = document.getElementById("appPanel");
  var authPanel = document.getElementById("authPanel");
  var loginForm = document.getElementById("loginForm");
  var loginEmail = document.getElementById("loginEmail");
  var loginPassword = document.getElementById("loginPassword");
  var authMessage = document.getElementById("authMessage");
  var userEmail = document.getElementById("userEmail");
  var signOutButton = document.getElementById("signOutButton");
  var bookForm = document.getElementById("bookForm");
  var newBookMonth = document.getElementById("newBookMonth");
  var bookList = document.getElementById("bookList");
  var expenseBook = document.getElementById("expenseBook");
  var activeBookLabel = document.getElementById("activeBookLabel");
  var form = document.getElementById("expenseForm");
  var expenseId = document.getElementById("expenseId");
  var expenseDate = document.getElementById("expenseDate");
  var expenseName = document.getElementById("expenseName");
  var expenseAmount = document.getElementById("expenseAmount");
  var expenseCategory = document.getElementById("expenseCategory");
  var expensePaidBy = document.getElementById("expensePaidBy");
  var expenseNote = document.getElementById("expenseNote");
  var appMessage = document.getElementById("appMessage");
  var rows = document.getElementById("expenseRows");
  var emptyState = document.getElementById("emptyState");
  var formTitle = document.getElementById("formTitle");
  var submitButton = document.getElementById("submitButton");
  var cancelEdit = document.getElementById("cancelEdit");
  var filterFrom = document.getElementById("filterFrom");
  var filterTo = document.getElementById("filterTo");
  var filterCategory = document.getElementById("filterCategory");
  var clearFilters = document.getElementById("clearFilters");
  var todayTotal = document.getElementById("todayTotal");
  var monthTotal = document.getElementById("monthTotal");
  var recordCount = document.getElementById("recordCount");
  var averageSpend = document.getElementById("averageSpend");

  var app;
  var auth;
  var db;
  var currentUser = null;
  var months = [];
  var selectedMonthId = getMonthId(todayAsInput());
  var expenses = [];
  var monthUnsubscribe = null;
  var expenseUnsubscribes = [];
  var editingMonthId = "";

  expenseDate.value = todayAsInput();
  expenseDate.min = selectedMonthId + "-01";
  expenseDate.max = lastDateForMonth(selectedMonthId);
  newBookMonth.value = selectedMonthId;
  render();

  if (firebaseConfig.apiKey.indexOf("PASTE_") === 0) {
    authMessage.textContent = "Add your Firebase config in expense-tracker.js before signing in.";
    loginForm.querySelector("button").disabled = true;
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, function (user) {
      currentUser = user;
      if (user) {
        userEmail.textContent = user.email || "";
        authPanel.classList.add("hidden");
        appPanel.classList.remove("hidden");
        ensureMonthBook(selectedMonthId).catch(function (error) {
          setStatus(friendlyFirebaseError(error), "error");
        });
        listenForSharedExpenses();
      } else {
        stopListening();
        expenses = [];
        render();
        appPanel.classList.add("hidden");
        authPanel.classList.remove("hidden");
      }
    });
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    authMessage.textContent = "Signing in...";
    signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value)
      .then(function () {
        loginForm.reset();
        authMessage.textContent = "";
      })
      .catch(function (error) {
        authMessage.textContent = error.message;
      });
  });

  signOutButton.addEventListener("click", function () {
    signOut(auth);
  });

  bookForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser || !newBookMonth.value) {
      return;
    }

    try {
      setStatus("Creating book...", "");
      await ensureMonthBook(newBookMonth.value);
      selectMonthBook(newBookMonth.value);
      setStatus("Book is ready.", "success");
    } catch (error) {
      setStatus(friendlyFirebaseError(error), "error");
    }
  });

  bookList.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-month-id]");
    if (button) {
      selectMonthBook(button.getAttribute("data-month-id"));
    }
  });

  expenseBook.addEventListener("change", function () {
    selectMonthBook(expenseBook.value);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    var monthId = expenseBook.value || getMonthId(expenseDate.value);
    var record = {
      date: expenseDate.value,
      name: expenseName.value.trim(),
      amount: Number(expenseAmount.value),
      category: expenseCategory.value,
      paidBy: expensePaidBy.value,
      note: expenseNote.value.trim(),
      monthId: monthId,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };

    if (!record.date || !record.name || !record.amount || record.amount <= 0) {
      return;
    }

    if (record.date.slice(0, 7) !== monthId) {
      record.date = defaultDateForMonth(monthId);
    }

    submitButton.disabled = true;
    setStatus("Saving expense...", "");

    try {
      await ensureMonthBook(monthId);

      if (expenseId.value) {
        if (editingMonthId && editingMonthId !== monthId) {
          await deleteDoc(expenseDoc(editingMonthId, expenseId.value));
          await setDoc(expenseDoc(monthId, expenseId.value), {
            ...record,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
          });
        } else {
          await updateDoc(expenseDoc(monthId, expenseId.value), record);
        }
      } else {
        await addDoc(expenseCollection(monthId), {
          ...record,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
      }

      resetForm();
      setStatus("Expense saved to Firebase.", "success");
    } catch (error) {
      setStatus(friendlyFirebaseError(error), "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  rows.addEventListener("click", async function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var id = button.getAttribute("data-id");
    var action = button.getAttribute("data-action");
    var record = expenses.find(function (item) {
      return item.id === id;
    });

    if (!record) {
      return;
    }

    if (action === "edit") {
      startEdit(record);
    }

    if (action === "delete") {
      try {
        await deleteDoc(expenseDoc(record.monthId, id));
        setStatus("Expense deleted.", "success");
      } catch (error) {
        setStatus(friendlyFirebaseError(error), "error");
      }
    }
  });

  [filterFrom, filterTo, filterCategory].forEach(function (control) {
    control.addEventListener("input", render);
  });

  cancelEdit.addEventListener("click", resetForm);

  clearFilters.addEventListener("click", function () {
    filterFrom.value = "";
    filterTo.value = "";
    filterCategory.value = "All";
    render();
  });

  function render() {
    renderBooks();
    var visibleExpenses = getFilteredExpenses();
    visibleExpenses.sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });

    rows.innerHTML = "";
    var activeMonth = "";
    visibleExpenses.forEach(function (item) {
      if (item.monthId !== activeMonth) {
        activeMonth = item.monthId;
        rows.appendChild(createMonthRow(activeMonth));
      }
      rows.appendChild(createExpenseRow(item));
    });

    emptyState.classList.toggle("hidden", visibleExpenses.length > 0);
    updateSummary();
  }

  function createMonthRow(monthId) {
    var row = document.createElement("tr");
    row.className = "month-row";
    row.innerHTML = "<td colspan=\"6\">" + escapeHtml(formatMonthLabel(monthId)) + "</td>";
    return row;
  }

  function createExpenseRow(item) {
    var row = document.createElement("tr");
    row.innerHTML = [
      "<td data-label=\"Date\">" + formatDate(item.date) + "</td>",
      "<td data-label=\"Description\"><div class=\"row-title\">" + escapeHtml(item.name) + "</div>" + renderNote(item.note) + "</td>",
      "<td data-label=\"Category\"><span class=\"tag\">" + escapeHtml(item.category) + "</span></td>",
      "<td data-label=\"Paid by\"><span class=\"payer-pill\">" + escapeHtml(item.paidBy || "-") + "</span></td>",
      "<td data-label=\"Amount\" class=\"amount-cell\">" + formatMoney(item.amount) + "</td>",
      "<td data-label=\"Actions\"><div class=\"actions\">",
      "<button type=\"button\" class=\"ghost-button\" data-action=\"edit\" data-id=\"" + item.id + "\">Edit</button>",
      "<button type=\"button\" class=\"danger-button\" data-action=\"delete\" data-id=\"" + item.id + "\">Delete</button>",
      "</div></td>"
    ].join("");
    return row;
  }

  function renderNote(note) {
    return note ? "<div class=\"row-note\">" + escapeHtml(note) + "</div>" : "";
  }

  function getFilteredExpenses() {
    return expenses.filter(function (item) {
      var bookMatches = !selectedMonthId || item.monthId === selectedMonthId;
      var fromMatches = !filterFrom.value || item.date >= filterFrom.value;
      var toMatches = !filterTo.value || item.date <= filterTo.value;
      var categoryMatches = filterCategory.value === "All" || item.category === filterCategory.value;
      return bookMatches && fromMatches && toMatches && categoryMatches;
    });
  }

  function updateSummary() {
    var today = todayAsInput();
    var visibleExpenses = getFilteredExpenses();
    var month = selectedMonthId || today.slice(0, 7);
    var allTotal = visibleExpenses.reduce(sumAmount, 0);
    var monthSum = expenses.filter(function (item) {
      return item.monthId === month;
    }).reduce(sumAmount, 0);
    var todaySum = expenses.filter(function (item) {
      return item.date === today;
    }).reduce(sumAmount, 0);

    todayTotal.textContent = formatMoney(todaySum);
    monthTotal.textContent = formatMoney(monthSum);
    recordCount.textContent = String(visibleExpenses.length);
    averageSpend.textContent = formatMoney(visibleExpenses.length ? allTotal / visibleExpenses.length : 0);
  }

  function sumAmount(total, item) {
    return total + Number(item.amount || 0);
  }

  function startEdit(record) {
    expenseId.value = record.id;
    editingMonthId = record.monthId;
    selectMonthBook(record.monthId);
    expenseDate.value = record.date;
    expenseName.value = record.name;
    expenseAmount.value = record.amount;
    expenseCategory.value = record.category;
    expensePaidBy.value = record.paidBy || "yc";
    expenseNote.value = record.note || "";
    formTitle.textContent = "Edit expense";
    submitButton.textContent = "Update expense";
    cancelEdit.classList.remove("hidden");
    expenseName.focus();
  }

  function resetForm() {
    form.reset();
    expenseId.value = "";
    editingMonthId = "";
    expenseBook.value = selectedMonthId;
    expenseDate.value = defaultDateForMonth(selectedMonthId);
    formTitle.textContent = "Add expense";
    submitButton.textContent = "Save expense";
    cancelEdit.classList.add("hidden");
  }

  function listenForSharedExpenses() {
    stopListening();

    monthUnsubscribe = onSnapshot(collection(db, "households", householdId, "months"), function (snapshot) {
      expenseUnsubscribes.forEach(function (unsubscribe) {
        unsubscribe();
      });
      expenseUnsubscribes = [];
      expenses = [];
      months = [];
      render();

      snapshot.forEach(function (monthSnapshot) {
        var monthId = monthSnapshot.id;
        months.push({
          id: monthId,
          label: monthSnapshot.data().label || formatMonthLabel(monthId)
        });
        var unsubscribeExpenses = onSnapshot(query(expenseCollection(monthId), orderBy("date", "desc")), function (expenseSnapshot) {
          expenses = expenses.filter(function (item) {
            return item.monthId !== monthId;
          });

          expenseSnapshot.forEach(function (expenseSnapshotItem) {
            expenses.push({
              id: expenseSnapshotItem.id,
              ...expenseSnapshotItem.data(),
              monthId: monthId
            });
          });

        render();
      }, function (error) {
        setStatus(friendlyFirebaseError(error), "error");
      });

      expenseUnsubscribes.push(unsubscribeExpenses);
    });
      months.sort(function (a, b) {
        return b.id.localeCompare(a.id);
      });
      if (!months.some(function (month) { return month.id === selectedMonthId; }) && months.length) {
        selectedMonthId = months[0].id;
      }
      render();
    }, function (error) {
      setStatus(friendlyFirebaseError(error), "error");
      stopListening();
    });
  }

  function stopListening() {
    if (monthUnsubscribe) {
      monthUnsubscribe();
      monthUnsubscribe = null;
    }
    expenseUnsubscribes.forEach(function (unsubscribe) {
      unsubscribe();
    });
    expenseUnsubscribes = [];
  }

  function monthDoc(monthId) {
    return doc(db, "households", householdId, "months", monthId);
  }

  function expenseCollection(monthId) {
    return collection(db, "households", householdId, "months", monthId, "expenses");
  }

  function expenseDoc(monthId, id) {
    return doc(db, "households", householdId, "months", monthId, "expenses", id);
  }

  function getMonthId(dateValue) {
    return dateValue.slice(0, 7);
  }

  async function ensureMonthBook(monthId) {
    await setDoc(monthDoc(monthId), {
      label: formatMonthLabel(monthId),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  function selectMonthBook(monthId) {
    selectedMonthId = monthId;
    expenseBook.value = monthId;
    newBookMonth.value = monthId;
    if (!expenseDate.value || expenseDate.value.slice(0, 7) !== monthId) {
      expenseDate.value = defaultDateForMonth(monthId);
    }
    expenseDate.min = monthId + "-01";
    expenseDate.max = lastDateForMonth(monthId);
    render();
  }

  function renderBooks() {
    var knownMonths = months.slice();
    if (!knownMonths.some(function (month) { return month.id === selectedMonthId; })) {
      knownMonths.push({
        id: selectedMonthId,
        label: formatMonthLabel(selectedMonthId)
      });
    }

    knownMonths.sort(function (a, b) {
      return b.id.localeCompare(a.id);
    });

    expenseBook.innerHTML = "";
    bookList.innerHTML = "";
    knownMonths.forEach(function (month) {
      var option = document.createElement("option");
      option.value = month.id;
      option.textContent = month.label;
      expenseBook.appendChild(option);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "book-button" + (month.id === selectedMonthId ? " active" : "");
      button.setAttribute("data-month-id", month.id);
      button.innerHTML = "<span>" + escapeHtml(month.label) + "</span><strong>" + formatMoney(totalForMonth(month.id)) + "</strong>";
      bookList.appendChild(button);
    });

    expenseBook.value = selectedMonthId;
    activeBookLabel.textContent = selectedMonthId ? formatMonthLabel(selectedMonthId) : "No book selected";
  }

  function totalForMonth(monthId) {
    return expenses.filter(function (item) {
      return item.monthId === monthId;
    }).reduce(sumAmount, 0);
  }

  function defaultDateForMonth(monthId) {
    var today = todayAsInput();
    if (today.slice(0, 7) === monthId) {
      return today;
    }
    return monthId + "-01";
  }

  function lastDateForMonth(monthId) {
    var parts = monthId.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    return new Date(year, month, 0).toISOString().slice(0, 10);
  }

  function formatMonthLabel(monthId) {
    return new Date(monthId + "-01T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long"
    });
  }

  function todayAsInput() {
    var now = new Date();
    var offset = now.getTimezoneOffset();
    var localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatMoney(value) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function friendlyFirebaseError(error) {
    if (!error || !error.code) {
      return "Firebase could not complete that action. Check your project setup.";
    }

    if (error.code === "permission-denied") {
      return "Permission denied. Add this user's UID as a household member in Firestore.";
    }

    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      return "Email or password is incorrect.";
    }

    if (error.code === "failed-precondition") {
      return "Firestore needs an index or setup change. Check the Firebase console message.";
    }

    return error.message || "Firebase could not complete that action.";
  }

  function setStatus(message, type) {
    appMessage.textContent = message || "";
    appMessage.classList.toggle("status-error", type === "error");
    appMessage.classList.toggle("status-success", type === "success");
  }

})();

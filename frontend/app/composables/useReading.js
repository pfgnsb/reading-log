export function useReading() {
  var loggedIn = useState("loggedIn", function () { return false; });
  var userName = useState("userName", function () { return ""; });
  var books = useState("books", function () { return []; });
  var loginMessage = useState("loginMessage", function () {
    return "ログインすると、自分の本を記録できます。";
  });
  var bookMessage = useState("bookMessage", function () { return ""; });
  var name = useState("name", function () { return ""; });
  var password = useState("password", function () { return ""; });
  var draft = useState("draft", function () {
    return { title: "", author: "", status: "want", memo: "" };
  });

  var labels = {
    want: "読みたい",
    reading: "読んでいる",
    done: "読み終わった"
  };

  function showLogin(text) {
    loggedIn.value = false;
    books.value = [];
    password.value = "";
    loginMessage.value = text || "ログインすると、自分の本を記録できます。";
  }

  async function loadBooks() {
    var res = await fetch("/api/books");
    if (res.status === 401) {
      showLogin();
      return;
    }
    if (!res.ok) return;
    books.value = await res.json();
  }

  async function loadMe() {
    var res = await fetch("/api/me");
    if (!res.ok) {
      showLogin();
      return;
    }
    var body = await res.json();
    userName.value = body.name;
    loggedIn.value = true;
    password.value = "";
    await loadBooks();
  }

  function explainAuth(status) {
    if (status === 409) {
      loginMessage.value = "その名前は使われています。";
      return;
    }
    if (status === 401) {
      loginMessage.value = "名前またはパスワードが違います。";
      return;
    }
    loginMessage.value = "名前は空白なしで1から32文字です。パスワードは8から64文字です。";
  }

  async function auth(path) {
    var res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.value,
        password: password.value
      })
    });
    if (!res.ok) {
      explainAuth(res.status);
      return;
    }
    var body = await res.json();
    userName.value = body.name;
    loggedIn.value = true;
    password.value = "";
    bookMessage.value = "";
    await loadBooks();
  }

  async function addBook() {
    var res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.value.title,
        author: draft.value.author,
        status: draft.value.status,
        memo: draft.value.memo
      })
    });
    if (res.status === 401) {
      showLogin();
      return;
    }
    if (!res.ok) {
      bookMessage.value = "題名と著者を入れてください。";
      return;
    }
    draft.value = { title: "", author: "", status: "want", memo: "" };
    bookMessage.value = "追加しました。";
    await loadBooks();
  }

  async function saveBook(id, fields) {
    var res = await fetch("/api/books/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    if (res.status === 401) {
      showLogin();
      return;
    }
    if (!res.ok) {
      bookMessage.value = "保存できませんでした。";
      return;
    }
    bookMessage.value = "保存しました。";
    await loadBooks();
  }

  async function deleteBook(id) {
    var res = await fetch("/api/books/" + id, { method: "DELETE" });
    if (res.status === 401) {
      showLogin();
      return;
    }
    if (!res.ok) {
      bookMessage.value = "削除できませんでした。";
      return;
    }
    bookMessage.value = "";
    await loadBooks();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    showLogin("ログインすると、自分の本を記録できます。");
  }

  return {
    labels: labels,
    loggedIn: loggedIn,
    userName: userName,
    books: books,
    loginMessage: loginMessage,
    bookMessage: bookMessage,
    name: name,
    password: password,
    draft: draft,
    loadMe: loadMe,
    auth: auth,
    addBook: addBook,
    saveBook: saveBook,
    deleteBook: deleteBook,
    logout: logout
  };
}

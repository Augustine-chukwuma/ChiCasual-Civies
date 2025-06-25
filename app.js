// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDXu5knkVt5SVvhdSnUNXrcrmF7p3hRONU",
  authDomain: "chicasual-civies-2a034.firebaseapp.com",
  projectId: "chicasual-civies-2a034"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Elements
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('authSection');
const mainSection = document.getElementById('mainSection');
const authMessage = document.getElementById('authMessage');

loginBtn.onclick = () => {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => authMessage.textContent = err.message);
};

signupBtn.onclick = () => {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  auth.createUserWithEmailAndPassword(email, pass)
    .catch(err => authMessage.textContent = err.message);
};

logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    authSection.style.display = "none";
    mainSection.style.display = "block";
    loadProducts();
  } else {
    authSection.style.display = "block";
    mainSection.style.display = "none";
  }
});

function loadProducts() {
  const productList = document.getElementById('productList');
  productList.innerHTML = "";
  db.collection("products").get().then(snapshot => {
    snapshot.forEach(doc => {
      const { name, price } = doc.data();
      const card = document.createElement("div");
      card.className = "mdl-card mdl-cell mdl-cell--4-col mdl-shadow--2dp";
      card.style.padding = "1rem";
      card.style.margin = "0.5rem";
      card.innerHTML = `
        <div class="mdl-card__title">
          <h5 class="mdl-card__title-text">${name}</h5>
        </div>
        <div class="mdl-card__supporting-text">
          Price: $${price}
        </div>
        <div class="mdl-card__actions mdl-card--border">
          <button class="mdl-button mdl-js-button mdl-button--accent">Buy</button>
        </div>`;
      productList.appendChild(card);
    });
  });
}

document.getElementById('uploadBtn').onclick = () => {
  const name = document.getElementById('prodName').value;
  const price = parseFloat(document.getElementById('prodPrice').value);
  if (!name || !price) return alert("Enter name and price");
  db.collection("products").add({ name, price })
    .then(() => {
      alert("Product uploaded!");
      loadProducts();
    })
    .catch(err => alert("Upload failed: " + err.message));
};

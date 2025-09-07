// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Config Firebase (thay bằng config của mày)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const userEmail = document.getElementById("userEmail");
const balanceEl = document.getElementById("balance");
const authSection = document.getElementById("auth-section");
const tradeSection = document.getElementById("trade-section");

// Đăng ký tài khoản
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), { balance: 1000 }); // Set số dư mặc định
    alert("Đăng ký thành công! Số dư mặc định: 1000");
  } catch (error) {
    alert("Lỗi đăng ký: " + error.message);
  }
});

// Đăng nhập
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Lỗi đăng nhập: " + error.message);
  }
});

// Đăng xuất
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Theo dõi trạng thái đăng nhập
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.style.display = "none";
    tradeSection.style.display = "block";
    userEmail.textContent = user.email;

    // Lấy số dư
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      balanceEl.textContent = userDoc.data().balance;
    }
  } else {
    authSection.style.display = "block";
    tradeSection.style.display = "none";
  }
});

// Nạp tiền
depositBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  let newBalance = userDoc.data().balance + 100;
  await updateDoc(userRef, { balance: newBalance });
  balanceEl.textContent = newBalance;
});

// Rút tiền
withdrawBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  let newBalance = userDoc.data().balance - 50;
  if (newBalance < 0) newBalance = 0;

  await updateDoc(userRef, { balance: newBalance });
  balanceEl.textContent = newBalance;
});


import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// =================== CẤU HÌNH FIREBASE ===================
const firebaseConfig = {
  apiKey: "AIzaSyANI-NhTbl8R20twhekpnXtzZvmkOLqP24",
  authDomain: "miketrading-3b86a.firebaseapp.com",
  projectId: "miketrading-3b86a",
  storageBucket: "miketrading-3b86a.firebasestorage.app",
  messagingSenderId: "692740435477",
  appId: "1:692740435477:web:e9b9a3696b87eef187e81c",
  measurementId: "G-3NX2TKD3NK"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =================== DOM ===================
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");
const balanceEl = document.getElementById("balance");
const authSection = document.getElementById("auth-section");
const userSection = document.getElementById("user-section");

// =================== ĐĂNG KÝ ===================
registerBtn.addEventListener("click", async () => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value
    );
    const user = userCredential.user;

    // Tạo document Firestore cho user
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      balance: 0,
      createdAt: new Date(),
    });

    alert("Đăng ký thành công!");
  } catch (error) {
    alert("Lỗi đăng ký: " + error.message);
  }
});

// =================== ĐĂNG NHẬP ===================
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    alert("Đăng nhập thành công!");
  } catch (error) {
    alert("Lỗi đăng nhập: " + error.message);
  }
});

// =================== ĐĂNG XUẤT ===================
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// =================== KIỂM TRA USER HIỆN TẠI ===================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.classList.add("hidden");
    userSection.classList.remove("hidden");
    userEmail.textContent = user.email;

    // Lấy balance từ Firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      balanceEl.textContent = docSnap.data().balance;
    } else {
      balanceEl.textContent = 0;
    }
  } else {
    authSection.classList.remove("hidden");
    userSection.classList.add("hidden");
  }
});

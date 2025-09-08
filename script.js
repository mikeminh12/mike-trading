// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyANI-NhTbl8R20twhekpnXtzZvmkOLqP24",
  authDomain: "miketrading-3b86a.firebaseapp.com",
  databaseURL: "https://miketrading-3b86a-default-rtdb.firebaseio.com",
  projectId: "miketrading-3b86a",
  storageBucket: "miketrading-3b86a.appspot.com",
  messagingSenderId: "692740435477",
  appId: "1:692740435477:web:e9b9a3696b87eef187e81c",
  measurementId: "G-3NX2TKD3NK"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Biến toàn cục
let currentUID = null;

// Đăng ký
function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (!email || !password) return alert("Nhập email và password!");

  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      const uid = userCredential.user.uid;
      db.ref("users/" + uid).set({
        username: email.split("@")[0],
        balanceUSD: 1000,
        mCoinAmount: 0
      }).then(() => {
        alert("Đăng ký thành công!");
        showDashboard(uid);
      });
    })
    .catch(error => alert(error.message));
}

// Đăng nhập
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  if (!email || !password) return alert("Nhập email và password!");

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => showDashboard(userCredential.user.uid))
    .catch(error => alert(error.message));
}

// Đăng xuất
function logout() {
  auth.signOut().then(() => {
    document.getElementById("auth").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
  });
}

// Dashboard realtime
function showDashboard(uid) {
  currentUID = uid;
  document.getElementById("auth").style.display = "none";
  document.getElementById("dashboard").style.display = "block";

  // User info realtime
  db.ref("users/" + uid).on("value", snap => {
    const data = snap.val();
    if (data) {
      document.getElementById("username").innerText = data.username;
      document.getElementById("balanceUSD").innerText = data.balanceUSD.toFixed(2);
      document.getElementById("mCoinAmount").innerText = data.mCoinAmount.toFixed(2);
    }
  });

  // Giá mCoin realtime + chart
  db.ref("market/mCoin").on("value", snap => {
    const data = snap.val();
    if (data) {
      document.getElementById("mCoinPrice").innerText = data.price.toFixed(2);
      const history = data.history || [];
      priceChart.data.labels = history.map((_, i) => i + 1);
      priceChart.data.datasets[0].data = history;
      priceChart.update();
    }
  });

  // Leaderboard realtime
  db.ref("users").on("value", snap => {
    const users = snap.val() || {};
    const sorted = Object.keys(users)
      .map(uid => ({ ...users[uid] }))
      .sort((a, b) => b.balanceUSD - a.balanceUSD);

    document.getElementById("leaderboard").innerHTML = sorted.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${u.username}</td>
        <td>${u.balanceUSD.toFixed(2)} USD</td>
        <td>${u.mCoinAmount.toFixed(2)}</td>
      </tr>
    `).join("");
  });
}

// Mua mCoin
function buyMCoin() {
  const amount = parseFloat(document.getElementById("tradeAmount").value);
  if (amount <= 0) return alert("Nhập số hợp lệ!");
  db.ref("market/mCoin/price").once("value").then(snap => {
    const price = snap.val();
    db.ref("users/" + currentUID).once("value").then(userSnap => {
      const user = userSnap.val();
      if (user.balanceUSD >= amount * price) {
        db.ref("users/" + currentUID).update({
          balanceUSD: user.balanceUSD - amount * price,
          mCoinAmount: user.mCoinAmount + amount
        });
        pushTrade(user.username, "mua", amount);
      } else alert("Không đủ USD!");
    });
  });
}

// Bán mCoin
function sellMCoin() {
  const amount = parseFloat(document.getElementById("tradeAmount").value);
  if (amount <= 0) return alert("Nhập số hợp lệ!");
  db.ref("market/mCoin/price").once("value").then(snap => {
    const price = snap.val();
    db.ref("users/" + currentUID).once("value").then(userSnap => {
      const user = userSnap.val();
      if (user.mCoinAmount >= amount) {
        db.ref("users/" + currentUID).update({
          balanceUSD: user.balanceUSD + amount * price,
          mCoinAmount: user.mCoinAmount - amount
        });
        pushTrade(user.username, "bán", amount);
      } else alert("Không đủ mCoin!");
    });
  });
}

// Ghi thông báo mua/bán vào DB
function pushTrade(username, action, amount) {
  db.ref("trades").push({
    username, action, amount,
    time: Date.now()
  });
}

// Hiển thị thông báo realtime
db.ref("trades").on("child_added", snap => {
  const data = snap.val();
  const li = document.createElement("li");
  li.textContent = `${data.username} vừa ${data.action} ${data.amount} mCoin`;
  document.getElementById("notificationList").prepend(li);
  document.getElementById("notifications").style.display = "block";
  setTimeout(() => li.remove(), 5000);
});

// Chart.js config
const ctx = document.getElementById("priceChart").getContext("2d");
const priceChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "mCoin Price",
      data: [],
      borderColor: "rgb(75, 192, 192)",
      backgroundColor: "rgba(75, 192, 192, 0.2)",
      tension: 0.3
    }]
  },
  options: { responsive: true }
});

// Khởi tạo giá mCoin nếu chưa có
function startPriceSimulator() {
  const marketRef = db.ref("market/mCoin");
  marketRef.once("value").then(snap => {
    if (!snap.exists()) {
      marketRef.set({ price: 50, history: [50] });
    }
  });

  setInterval(() => {
    marketRef.once("value").then(snap => {
      let price = snap.val().price;
      let history = snap.val().history || [];
      const fluctuation = (Math.random() - 0.5) * 2;
      price = Math.max(1, price + fluctuation);
      history.push(price);
      if (history.length > 50) history.shift();
      marketRef.update({ price, history });
    });
  }, 5000);
}

startPriceSimulator();

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

// === Đăng ký ===
function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return alert("Nhập email và password!");

    auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
        const uid = userCredential.user.uid;
        db.ref('users/' + uid).set({
            username: email.split('@')[0],
            balanceUSD: 1000,
            mCoinAmount: 0
        }).then(() => {
            alert('Đăng ký thành công!');
            showDashboard(uid);
        });
    })
    .catch(error => alert(error.message));
}

// === Đăng nhập ===
function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return alert("Nhập email và password!");

    auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
        showDashboard(userCredential.user.uid);
    })
    .catch(error => alert(error.message));
}

// === Đăng xuất ===
function logout() {
    auth.signOut().then(() => {
        document.getElementById('auth').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    });
}

// === Dashboard ===
function showDashboard(uid) {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Load user info realtime
    db.ref('users/' + uid).on('value', snap => {
        const data = snap.val();
        if(data){
            document.getElementById('username').innerText = data.username;
            document.getElementById('balanceUSD').innerText = data.balanceUSD.toFixed(2);
            document.getElementById('mCoinAmount').innerText = data.mCoinAmount.toFixed(2);
        }
    });

    // Load giá mCoin realtime
    db.ref('market/mCoin').on('value', snap => {
        const data = snap.val();
        if(data){
            document.getElementById('mCoinPrice').innerText = data.price.toFixed(2);
            const history = data.history || [];
            priceChart.data.labels = history.map((_, i) => i+1);
            priceChart.data.datasets[0].data = history;
            priceChart.update();
        }
    });

    // === FIX bảng xếp hạng realtime ===
    db.ref('users').on('value', snap => {
        const users = [];
        snap.forEach(child => {
            const u = child.val();
            const price = priceChart.data.datasets[0].data.slice(-1)[0] || 50;
            const asset = u.balanceUSD + u.mCoinAmount * price;
            users.push({ username: u.username, asset });
        });

        users.sort((a,b) => b.asset - a.asset);
        const body = document.getElementById('leaderboardBody');
        body.innerHTML = '';

        users.forEach((u, i) => {
            body.innerHTML += `
                <tr>
                    <td>${i+1}</td>
                    <td>${u.username}</td>
                    <td>$${u.asset.toFixed(2)}</td>
                </tr>`;
        });
    });

    // === Lắng nghe thông báo realtime ===
    db.ref('notifications').on('child_added', snap => {
        showToast(snap.val());
    });
}

// === Gửi thông báo ===
function pushNotification(msg) {
    db.ref('notifications').push().set(msg);
}

// === Hiển thị toast ===
function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// === Mua mCoin ===
function buyMCoin() {
    const uid = auth.currentUser.uid;
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    if(amount <= 0) return alert('Nhập số hợp lệ!');

    db.ref('market/mCoin/price').once('value').then(snap => {
        const price = snap.val();
        db.ref('users/' + uid).once('value').then(userSnap => {
            const user = userSnap.val();
            if(user.balanceUSD >= amount * price){
                db.ref('users/' + uid).update({
                    balanceUSD: user.balanceUSD - amount * price,
                    mCoinAmount: user.mCoinAmount + amount
                });
                pushNotification(`${user.username} vừa mua ${amount} mCoin 💸`);
            } else alert('Không đủ USD!');
        });
    });
}

// === Bán mCoin ===
function sellMCoin() {
    const uid = auth.currentUser.uid;
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    if(amount <= 0) return alert('Nhập số hợp lệ!');

    db.ref('market/mCoin/price').once('value').then(snap => {
        const price = snap.val();
        db.ref('users/' + uid).once('value').then(userSnap => {
            const user = userSnap.val();
            if(user.mCoinAmount >= amount){
                db.ref('users/' + uid).update({
                    balanceUSD: user.balanceUSD + amount * price,
                    mCoinAmount: user.mCoinAmount - amount
                });
                pushNotification(`${user.username} vừa bán ${amount} mCoin 💰`);
            } else alert('Không đủ mCoin!');
        });
    });
}

// === Chart.js ===
const ctx = document.getElementById('priceChart').getContext('2d');
const priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'mCoin Price', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.2 }] },
    options: { responsive: true }
});

// === Price simulator ===
function startPriceSimulator() {
    const marketRef = db.ref('market/mCoin');
    marketRef.once('value').then(snap => {
        if(!snap.exists()){
            marketRef.set({ price: 50, history: [50] });
        }
    });

    setInterval(() => {
        marketRef.once('value').then(snap => {
            let price = snap.val().price;
            let history = snap.val().history || [];
            const fluctuation = (Math.random() - 0.5) * 2;
            price = Math.max(1, price + fluctuation);
            history.push(price);
            if(history.length > 50) history.shift();
            marketRef.update({ price, history });
        });
    }, 5000);
}
startPriceSimulator();

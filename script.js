// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Register
function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
        const uid = userCredential.user.uid;
        db.ref('users/' + uid).set({
            username: email.split('@')[0],
            balanceUSD: 1000,
            mCoinAmount: 0
        });
        alert('Đăng ký thành công!');
    })
    .catch(error => alert(error.message));
}

// Login
function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
        showDashboard(userCredential.user.uid);
    })
    .catch(error => alert(error.message));
}

// Show dashboard
function showDashboard(uid) {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Load user info
    db.ref('users/' + uid).on('value', snap => {
        const data = snap.val();
        document.getElementById('username').innerText = data.username;
        document.getElementById('balanceUSD').innerText = data.balanceUSD.toFixed(2);
        document.getElementById('mCoinAmount').innerText = data.mCoinAmount.toFixed(2);
    });

    // Load mCoin price
    db.ref('market/mCoin/price').on('value', snap => {
        document.getElementById('mCoinPrice').innerText = snap.val().toFixed(2);
    });
}

// Buy mCoin
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
            } else alert('Không đủ USD!');
        });
    });
}

// Sell mCoin
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
            } else alert('Không đủ mCoin!');
        });
    });
}

// Logout
function logout() {
    auth.signOut().then(() => {
        document.getElementById('auth').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    });
}

// mCoin price simulator
function startPriceSimulator() {
    db.ref('market/mCoin').once('value').then(snap => {
        if(!snap.exists()) {
            db.ref('market/mCoin').set({ price: 50, history: [50] });
        }
    });

    setInterval(() => {
        const fluctuation = (Math.random() - 0.5) * 2; // ±1 USD
        const marketRef = db.ref('market/mCoin');

        marketRef.once('value').then(snap => {
            let price = snap.val().price;
            let history = snap.val().history || [];

            price = Math.max(1, price + fluctuation); // giá không âm
            history.push(price);
            if(history.length > 50) history.shift(); // giữ 50 điểm gần nhất

            marketRef.update({ price, history });
        });
    }, 5000);
}

// Chart.js setup
const ctx = document.getElementById('priceChart').getContext('2d');
const priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'mCoin Price', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.1 }] },
    options: { responsive: true }
});

// Update chart realtime
db.ref('market/mCoin/history').on('value', snap => {
    const history = snap.val() || [];
    priceChart.data.labels = history.map((_, i) => i+1);
    priceChart.data.datasets[0].data = history;
    priceChart.update();
});

// Start simulator
startPriceSimulator();

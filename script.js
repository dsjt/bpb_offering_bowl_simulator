// ラウンド別レアリティ排出率（%）
const RARITY_RATES = {
    1: { "コモン": 90, "レア": 10, "エピック": 0, "レジェンダリ": 0, "ゴッド": 0 },
    2: { "コモン": 84, "レア": 15, "エピック": 1, "レジェンダリ": 0, "ゴッド": 0 },
    3: { "コモン": 75, "レア": 20, "エピック": 5, "レジェンダリ": 0, "ゴッド": 0 },
    4: { "コモン": 64, "レア": 25, "エピック": 10, "レジェンダリ": 1, "ゴッド": 0 },
    5: { "コモン": 45, "レア": 35, "エピック": 15, "レジェンダリ": 5, "ゴッド": 0 },
    6: { "コモン": 29, "レア": 40, "エピック": 20, "レジェンダリ": 10, "ゴッド": 1 },
    7: { "コモン": 20, "レア": 35, "エピック": 25, "レジェンダリ": 15, "ゴッド": 5 },
    8: { "コモン": 20, "レア": 30, "エピック": 25, "レジェンダリ": 15, "ゴッド": 10 },
    9: { "コモン": 20, "レア": 28, "エピック": 25, "レジェンダリ": 20, "ゴッド": 12 },
    10: { "コモン": 20, "レア": 25, "エピック": 25, "レジェンダリ": 25, "ゴッド": 15 },
    11: { "コモン": 20, "レア": 23, "エピック": 23, "レジェンダリ": 17, "ゴッド": 17 },
    12: { "コモン": 20, "レア": 20, "エピック": 20, "レジェンダリ": 20, "ゴッド": 20 }
};

// 高価格帯選択確率
const HIGH_TIER_PROBABILITY = 0.9;

let isRelativeScale = true; // 相対表示がデフォルト

let chartInstance = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    console.log('アイテムデータ読み込み完了:', itemsData.items.length, '個のアイテム');
});

// イベントリスナーの設定
function setupEventListeners() {
    const offeringAmount = document.getElementById('offering-amount');
    const offeringAmountValue = document.getElementById('offering-amount-value');
    const offeringAmountInput = document.getElementById('offering-amount-input');

    offeringAmount.addEventListener('input', (e) => {
        offeringAmountInput.value = e.target.value;
        updateItemPool();
        calculateProbabilities(); // 追加
    });

    offeringAmountInput.addEventListener('input', (e) => {
        offeringAmount.value = e.target.value;
        updateItemPool();
        calculateProbabilities(); // 追加
    });

    document.getElementById('round').addEventListener('change', () => {
        updateItemPool();
        calculateProbabilities();
    });

    document.querySelectorAll('[id^="badge-"]').forEach(cb => {
        cb.addEventListener('change', () => {
            updateItemPool();
            calculateProbabilities();
        });
    });

    document.querySelectorAll('[id^="special-"]').forEach(cb => {
        cb.addEventListener('change', () => {
            updateItemPool();
            calculateProbabilities();
        });
    });

    // テーブルのソート機能
    document.querySelectorAll('#item-pool-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => sortTable(th.dataset.sort));
    });

    // スケール切り替えボタン
    document.getElementById('toggle-scale-btn').addEventListener('click', () => {
        isRelativeScale = !isRelativeScale;
        const btn = document.getElementById('toggle-scale-btn');
        btn.textContent = isRelativeScale ? '絶対表示に切り替え' : '相対表示に切り替え';
        displayItemPoolTable(); // 再描画
    });

    // 初期表示
    updateItemPool();
    calculateProbabilities();
}

let currentSort = { column: 'price', order: 'asc' };
let currentPool = { highTier: [], lowTier: [] };

// アイテムプールの更新
function updateItemPool() {
    const budget = parseInt(document.getElementById('offering-amount').value)-1; // 1フレイム分を除く
    const round = parseInt(document.getElementById('round').value);

    const badges = [];
    // 通常バッジのみを配列に追加（ストーンとレインボーは除外）
    ['badge-leaf', 'badge-skull', 'badge-wolf', 'badge-magic', 'badge-string'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox.checked) {
            badges.push(checkbox.value);
        }
    });

    const specialItems = [];
    document.querySelectorAll('[id^="special-"]:checked').forEach(cb => {
        specialItems.push(cb.value);
    });

    const filteredItems = filterItemPool(round, badges, specialItems, budget);
    const { highTier, lowTier } = splitPriceTiers(filteredItems);

    currentPool = { highTier, lowTier };
    displayItemPoolTable();
}

// テーブル表示
function displayItemPoolTable() {
    // サマリーの更新
    updatePoolSummary();

    const tbody = document.getElementById('item-pool-body');
    const allItems = [
        ...currentPool.highTier.map(item => ({ ...item, tier: 'high' })),
        ...currentPool.lowTier.map(item => ({ ...item, tier: 'low' }))
    ];

    if (allItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="placeholder">条件に合うアイテムがありません</td></tr>';
        return;
    }

    // ソート
    const sorted = sortItems(allItems, currentSort.column, currentSort.order);

    // スケールの決定
    let maxProb;
    if (isRelativeScale) {
        // 相対表示: 最大値で正規化
        maxProb = Math.max(...Object.values(itemProbabilities));
    } else {
        // 絶対表示: 100%固定
        maxProb = 100;
    }

    tbody.innerHTML = sorted.map(item => {
        const prob = itemProbabilities[item.id] || 0;
        const barWidth = maxProb > 0 ? (prob / maxProb * 100) : 0;

        return `
            <tr>
                <td>${item.name}</td>
                <td>${item.price}G</td>
                <td>${item.rarity}</td>
                <td><span class="tier-badge tier-${item.tier}">${item.tier === 'high' ? '高価格帯' : '低価格帯'}</span></td>
                <td>
                    <div class="probability-cell">
                        <div class="probability-bar-container">
                            <div class="probability-bar tier-${item.tier}" style="width: ${barWidth}%"></div>
                        </div>
                        <span class="probability-text">${prob > 0 ? prob.toFixed(2) + '%' : '-'}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ソート処理
function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.order = 'asc';
    }

    // ヘッダーの表示更新
    document.querySelectorAll('#item-pool-table th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    document.querySelector(`th[data-sort="${column}"]`).classList.add(`sorted-${currentSort.order}`);

    displayItemPoolTable();
}

// アイテムのソート
function sortItems(items, column, order) {
    const sorted = [...items].sort((a, b) => {
        let valA, valB;

        switch(column) {
            case 'price':
                valA = a.price;
                valB = b.price;
                break;
            case 'name':
                return order === 'asc'
                    ? a.name.localeCompare(b.name, 'ja')
                    : b.name.localeCompare(a.name, 'ja');
            case 'rarity':
                const rarityOrder = ['コモン', 'レア', 'エピック', 'レジェンダリ', 'ゴッド'];
                valA = rarityOrder.indexOf(a.rarity);
                valB = rarityOrder.indexOf(b.rarity);
                break;
            case 'tier':
                valA = a.tier === 'high' ? 1 : 0;
                valB = b.tier === 'high' ? 1 : 0;
                break;
            case 'probability':
                valA = itemProbabilities[a.id] || 0;
                valB = itemProbabilities[b.id] || 0;
                break;
            default:
                return 0;
        }

        return order === 'asc' ? valA - valB : valB - valA;
    });

    return sorted;
}

// アイテムプールのフィルタリング
function filterItemPool(round, badges, specialItems,budget) {
    const roundRates = RARITY_RATES[round];
    const hasStone = document.getElementById('badge-stone').checked;
    const hasRainbow = document.getElementById('badge-rainbow').checked;

    // クラスフィルタの決定
    let allowedClasses;
    if (hasRainbow) {
        // レインボーバッジ: すべてのクラス
        allowedClasses = ['all', 'パイロマンサー', 'レンジャー', 'リーパー', 'バーサーカー', 'メイジ', 'アドベンチャラー'];
    } else if (hasStone) {
        // ストーンバッジ: パイロマンサーを除外
        allowedClasses = ['all', ...badges];
        // パイロマンサーは含めない
    } else {
        // 通常: パイロマンサー + 選択されたバッジ
        allowedClasses = ['all', 'パイロマンサー', ...badges];
    }

    const allowedSpecialItems = [false, ...specialItems];


    let filteredItems = itemsData.items.filter(item => {
        // 合成専用アイテムを除外
        if (item.crafted) return false;

        // ユニークレアリティを除外
        if (item.rarity === 'ユニーク') return false;

        // レアリティチェック（排出率が0%のレアリティは除外）
        if (!roundRates[item.rarity] || roundRates[item.rarity] === 0) return false;

        // 予算チェック
        if (item.price > budget) return false;

        // 特殊アイテムチェック
        // false以外の時は除外
        if (item.special_items) return false;

        // クラスチェック
        const hasMatchingClass = item.classes.some(cls => allowedClasses.includes(cls));
        if (!hasMatchingClass) return false;

        return true;
    });

    // 特殊アイテムによる追加
    specialItems.forEach(specialType => {
        if (specialType === 'frozen_flame') {
            // フローズンフレイム: 定義されたIDリストから追加
            const frozenItems = itemsData.items.filter(item => {
                return SPECIAL_ITEM_POOLS.frozen_flame.includes(item.id) &&
                    !item.crafted &&
                    item.rarity !== 'ユニーク' &&
                    roundRates[item.rarity] > 0 &&
                    item.price <= budget;
            });
            // 重複を避けて追加
            frozenItems.forEach(item => {
                if (!filteredItems.find(i => i.id === item.id)) {
                    filteredItems.push(item);
                }
            });
        } else {
            // その他の特殊アイテム: special_itemsフィールドで判定
            const specialTypeItems = itemsData.items.filter(item => {
                return item.special_items === specialType &&
                       !item.crafted &&
                       item.rarity !== 'ユニーク' &&
                       roundRates[item.rarity] > 0 &&
                       item.price <= budget;
            });
            // 重複を避けて追加
            specialTypeItems.forEach(item => {
                if (!filteredItems.find(i => i.id === item.id)) {
                    filteredItems.push(item);
                }
            });
        }
    });

    return filteredItems;
}

// 価格帯の分割
function splitPriceTiers(items) {
    if (items.length === 0) return { highTier: [], lowTier: [] };

    // 価格でグループ化
    const priceGroups = {};
    items.forEach(item => {
        if (!priceGroups[item.price]) {
            priceGroups[item.price] = [];
        }
        priceGroups[item.price].push(item);
    });

    // 価格でソート（降順）
    const sortedPrices = Object.keys(priceGroups).map(Number).sort((a, b) => b - a);

    // 最適な分割点を探す
    let bestSplit = 0;
    let minDifference = Infinity;

    const totalCount = items.length;
    let currentHighCount = 0;

    for (let i = 0; i < sortedPrices.length; i++) {
        currentHighCount += priceGroups[sortedPrices[i]].length;
        const currentLowCount = totalCount - currentHighCount;
        const difference = Math.abs(currentHighCount - currentLowCount);

        // 品目数の差が最小になる分割点を探す
        // 同じ差の場合、低価格帯が多くなる方を選択（i が大きい方）
        if (difference < minDifference || (difference === minDifference && currentLowCount > currentHighCount)) {
            minDifference = difference;
            bestSplit = i;
        }
    }

    // 分割実行
    const highTier = [];
    const lowTier = [];

    for (let i = 0; i < sortedPrices.length; i++) {
        if (i <= bestSplit) {
            highTier.push(...priceGroups[sortedPrices[i]]);
        } else {
            lowTier.push(...priceGroups[sortedPrices[i]]);
        }
    }

    return { highTier, lowTier };
}

// 動的計画法による厳密な確率計算
function calculateItemProbabilitiesDP(budget, highTier, lowTier) {
    const allItems = [...highTier, ...lowTier];

    // // 事前計算: 各予算での価格帯分割を一度だけ計算
    // const tiersByBudget = new Map();
    // for (let b = 1; b <= budget; b++) {
    //     const affordableItems = allItems.filter(item => item.price <= b);
    //     if (affordableItems.length > 0) {
    //         tiersByBudget.set(b, splitPriceTiers(affordableItems));
    //     } else {
    //         tiersByBudget.set(b, { highTier: [], lowTier: [] });
    //     }
    // }

    // dp[残予算] = { itemId: 期待獲得数 }
    const dp = Array(budget + 1).fill(null).map(() => ({}));

    // 全アイテムIDを初期化
    allItems.forEach(item => {
        for (let b = 0; b <= budget; b++) {
            dp[b][item.id] = 0;
        }
    });

    // 予算ごとに計算（DP）
    for (let currentBudget = 1; currentBudget <= budget; currentBudget++) {
        const affordableItems = allItems.filter(item => item.price <= currentBudget);

        if (affordableItems.length === 0) continue;

        // この予算での価格帯分割を計算（効率が悪いが、保留中）
        const { highTier: currentHigh, lowTier: currentLow } = splitPriceTiers(affordableItems);
        // const { highTier: currentHigh, lowTier: currentLow } = tiersByBudget.get(currentBudget);

        // 高価格帯からの選択（確率90%）
        if (currentHigh.length > 0) {
            const probPerItem = HIGH_TIER_PROBABILITY / currentHigh.length;

            currentHigh.forEach(item => {
                const remainingBudget = currentBudget - item.price;

                dp[currentBudget][item.id] += probPerItem;

                if (remainingBudget > 0) {
                    allItems.forEach(futureItem => {
                        dp[currentBudget][futureItem.id] += probPerItem * dp[remainingBudget][futureItem.id];
                    });
                }
            });
        }

        // 低価格帯からの選択（確率10%）
        if (currentLow.length > 0) {
            const probPerItem = (1 - HIGH_TIER_PROBABILITY) / currentLow.length;

            currentLow.forEach(item => {
                const remainingBudget = currentBudget - item.price;

                dp[currentBudget][item.id] += probPerItem;

                if (remainingBudget > 0) {
                    allItems.forEach(futureItem => {
                        dp[currentBudget][futureItem.id] += probPerItem * dp[remainingBudget][futureItem.id];
                    });
                }
            });
        }
    }

    // 結果を取得
    const result = {};
    allItems.forEach(item => {
        result[item.id] = dp[budget][item.id] * 100;
    });

    return result;
}

// 確率計算（シミュレーション）
function calculateItemProbabilities(budget, highTier, lowTier) {
    const itemCounts = {};
    const numSimulations = 10000;

    // 全アイテムを初期化
    [...highTier, ...lowTier].forEach(item => {
        itemCounts[item.id] = 0;
    });

    // シミュレーション実行
    for (let sim = 0; sim < numSimulations; sim++) {
        let remainingBudget = budget;

        while (remainingBudget > 0) {
            // 高価格帯/低価格帯の選択
            const useHighTier = Math.random() < HIGH_TIER_PROBABILITY;
            const selectedTier = useHighTier ? highTier : lowTier;

            // 購入可能なアイテムのフィルタリング
            const affordableItems = selectedTier.filter(item => item.price <= remainingBudget);

            if (affordableItems.length === 0) break;

            // 一様ランダムに選択
            const selectedItem = affordableItems[Math.floor(Math.random() * affordableItems.length)];
            itemCounts[selectedItem.id]++;
            remainingBudget -= selectedItem.price;
        }
    }

    // 確率に変換
    const probabilities = {};
    Object.keys(itemCounts).forEach(itemId => {
        probabilities[itemId] = (itemCounts[itemId] / numSimulations) * 100;
    });

    return probabilities;
}

let itemProbabilities = {};

// 確率計算のメイン処理
function calculateProbabilities() {
    const budget = parseInt(document.getElementById('offering-amount').value);

    if (currentPool.highTier.length === 0 && currentPool.lowTier.length === 0) {
        alert('条件に合うアイテムがありません');
        return;
    }

    // 確率計算
    itemProbabilities = calculateItemProbabilitiesDP(budget, currentPool.highTier, currentPool.lowTier);

    // テーブル更新
    displayItemPoolTable();
}


// アイテムプールの表示
function displayItemPool(highTier, lowTier) {
    // 高価格帯
    const highTierItems = document.getElementById('high-tier-items');
    if (highTier.length > 0) {
        const sortedHigh = [...highTier].sort((a, b) => b.price - a.price);
        highTierItems.innerHTML = sortedHigh.map(item => `
            <div class="item-entry">
                <span class="item-name">${item.name}</span>
                <span class="item-price">${item.price}G</span>
                <span class="item-rarity">[${item.rarity}]</span>
            </div>
        `).join('');
        document.getElementById('high-tier-pool').querySelector('h3').textContent =
            `高価格帯 (${highTier.length}個) - 90%の確率で選択`;
    } else {
        highTierItems.innerHTML = '<p class="placeholder">該当なし</p>';
    }

    // 低価格帯
    const lowTierItems = document.getElementById('low-tier-items');
    if (lowTier.length > 0) {
        const sortedLow = [...lowTier].sort((a, b) => b.price - a.price);
        lowTierItems.innerHTML = sortedLow.map(item => `
            <div class="item-entry">
                <span class="item-name">${item.name}</span>
                <span class="item-price">${item.price}G</span>
                <span class="item-rarity">[${item.rarity}]</span>
            </div>
        `).join('');
        document.getElementById('low-tier-pool').querySelector('h3').textContent =
            `低価格帯 (${lowTier.length}個) - 10%の確率で選択`;
    } else {
        lowTierItems.innerHTML = '<p class="placeholder">該当なし</p>';
    }
}

// 確率分布のグラフ表示
function displayProbabilityChart(items, probabilities) {
    const sortedItems = items
        .map(item => ({
            ...item,
            probability: probabilities[item.id] || 0
        }))
        .filter(item => item.probability > 0)
        .sort((a, b) => b.probability - a.probability);

    const labels = sortedItems.map(item => item.name);
    const data = sortedItems.map(item => item.probability);
    const colors = sortedItems.map(item => {
        return item.probability > 5 ? 'rgba(74, 144, 226, 0.8)' : 'rgba(149, 165, 166, 0.8)';
    });

    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('probability-chart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出現確率 (%)',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.x.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '出現確率 (%)',
                        color: '#eaeaea'
                    },
                    ticks: {
                        color: '#eaeaea'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#eaeaea',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        },
        plugins: [{
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        ctx.fillStyle = '#eaeaea';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';

                        const text = `${data.toFixed(2)}%`;
                        const x = bar.x + 5;
                        const y = bar.y;

                        ctx.fillText(text, x, y);
                    });
                });
            }
        }]
    });
}

// プールサマリーの更新
function updatePoolSummary() {
    const summaryContainer = document.getElementById('pool-summary');
    const allItems = [...currentPool.highTier, ...currentPool.lowTier];

    if (allItems.length === 0) {
        summaryContainer.innerHTML = '<p class="placeholder">条件に合うアイテムがありません</p>';
        return;
    }

    // 価格別の集計
    const priceCount = {};
    allItems.forEach(item => {
        priceCount[item.price] = (priceCount[item.price] || 0) + 1;
    });

    // 価格帯別の集計
    const highCount = currentPool.highTier.length;
    const lowCount = currentPool.lowTier.length;
    const totalCount = allItems.length;

    let html = '<div class="stacked-bar-title">価格別品目数</div>';
    html += '<div class="stacked-bar">';

    // 価格別の帯グラフ（昇順）
    const sortedPrices = Object.keys(priceCount).map(Number).sort((a, b) => a - b);
    sortedPrices.forEach(price => {
        const count = priceCount[price];
        const percentage = (count / totalCount) * 100;
        html += `
            <div class="stacked-segment" style="width: ${percentage}%" title="${price}G: ${count}個">
                <span class="segment-label">${price}G (${count})</span>
            </div>
        `;
    });

    html += '</div>';
    html += '<div class="summary-divider"></div>';

    // 価格帯別の帯グラフ
    const highPercentage = (highCount / totalCount) * 100;
    const lowPercentage = (lowCount / totalCount) * 100;

    html += '<div class="stacked-bar-title">価格帯別品目数</div>';
    html += '<div class="stacked-bar">';
    html += `
        <div class="stacked-segment tier-low" style="width: ${lowPercentage}%" title="低価格帯: ${lowCount}個">
            <span class="segment-label">低価格帯 (${lowCount})</span>
        </div>
        <div class="stacked-segment tier-high" style="width: ${highPercentage}%" title="高価格帯: ${highCount}個">
            <span class="segment-label">高価格帯 (${highCount})</span>
        </div>
    `;
    html += '</div>';

    summaryContainer.innerHTML = html;
}

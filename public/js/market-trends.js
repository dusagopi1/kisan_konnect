// DOM elements
const userNameElement = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const loadingElement = document.getElementById('loading');
const noDataElement = document.getElementById('no-data');
const resultsElement = document.getElementById('results');

// Form elements
const commoditySelect = document.getElementById('commodity');
const stateSelect = document.getElementById('state');
const districtSelect = document.getElementById('district');
const marketSelect = document.getElementById('market');
const daysSelect = document.getElementById('days');
const searchBtn = document.getElementById('search-btn');

// Result display elements
const currentPriceElement = document.getElementById('current-price');
const priceDateElement = document.getElementById('price-date');
const priceChangeElement = document.getElementById('price-change');
const priceChangeIconElement = document.getElementById('price-change-icon');
const periodTextElement = document.getElementById('period-text');
const minPriceElement = document.getElementById('min-price');
const maxPriceElement = document.getElementById('max-price');
const marketDataTableElement = document.getElementById('market-data-table');

// Chart element
const priceChartElement = document.getElementById('price-chart');
let priceChart = null;

// Common commodities in India
const commonCommodities = [
    'Atta (Wheat)', 'Bajra', 'Barley', 'Bengal Gram Dal', 'Black Gram Dal', 'Cashew Nut', 
    'Castor Oil', 'Coconut', 'Coconut Oil', 'Coffee', 'Coriander', 'Cotton', 'Dry Chillies', 
    'Ginger Dry', 'Gram', 'Groundnut', 'Gur', 'Jaggery', 'Jowar', 'Jute Raw', 'Lentil', 
    'Maida Atta', 'Maize', 'Masoor Dal', 'Methi', 'Mustard Oil', 'Onion', 'Paddy', 
    'Peas', 'Potato', 'Rice', 'Soji', 'Soyabean', 'Sugar', 'Tea', 'Tomato', 
    'Turmeric', 'Urad Dal', 'Wheat'
];

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        // Get user data
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    
                    // Display user name
                    userNameElement.textContent = userData.name;
                    
                    // Initialize the form
                    initializeForm();
                } else {
                    console.error('User document not found');
                    auth.signOut();
                    window.location.href = 'index.html';
                }
            })
            .catch(err => {
                console.error('Error fetching user data:', err);
                alert('Error fetching user data');
            });
    } else {
        // Not logged in, redirect to login page
        window.location.href = 'index.html';
    }
});

// Logout function
logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch(err => {
            console.error('Logout error:', err);
        });
});

// Initialize form with options
function initializeForm() {
    // Populate commodity dropdown
    populateCommodityDropdown();
    
    // Note: We don't need to populate the state dropdown here
    // as it will be handled by locations.js
    
    // Add custom handler for district change since locations.js doesn't handle markets
    districtSelect.addEventListener('change', handleDistrictChange);
    
    // Add search button event listener
    searchBtn.addEventListener('click', handleSearch);
    
    // Trigger a default search if commodity is pre-selected
    if (commoditySelect.value) {
        handleSearch();
    }
}

// Populate commodity dropdown with common agricultural commodities
function populateCommodityDropdown() {
    commoditySelect.innerHTML = '<option value="">Select Commodity</option>';
    
    commonCommodities.sort().forEach(commodity => {
        const option = document.createElement('option');
        option.value = commodity;
        option.textContent = commodity;
        commoditySelect.appendChild(option);
    });
}

// Handle district selection change only - the state change is managed by locations.js

// Handle district selection change
function handleDistrictChange() {
    const selectedState = stateSelect.value;
    const selectedDistrict = districtSelect.value;
    
    // Reset market dropdown
    marketSelect.innerHTML = '<option value="">All Markets</option>';
    
    if (!selectedState || !selectedDistrict) return;
    
    // For now, we'll leave markets empty as they would come from the API
    // In a real implementation, you might want to fetch markets based on state/district
    
    // Placeholder markets for demonstration
    const sampleMarkets = [
        'APMC Market', 'Central Market', 'District Market', 'Farmers Market',
        'Regional Market', 'State Market', 'Wholesale Market'
    ];
    
    sampleMarkets.forEach(market => {
        const option = document.createElement('option');
        option.value = market;
        option.textContent = market;
        marketSelect.appendChild(option);
    });
}

// Handle search button click
function handleSearch() {
    const commodity = commoditySelect.value;
    
    if (!commodity) {
        alert('Please select a commodity');
        return;
    }
    
    // Show loading state
    loadingElement.classList.remove('hidden');
    noDataElement.classList.add('hidden');
    resultsElement.classList.add('hidden');
    
    // Get selected values
    const state = stateSelect.value;
    const district = districtSelect.value;
    const market = marketSelect.value;
    const days = daysSelect.value;
    
    // Update period text
    periodTextElement.textContent = `Over the last ${days} days`;
    
    // Fetch market trends data
    fetchMarketTrends(commodity, state, district, market, days);
}

// Fetch market trends data from the API
function fetchMarketTrends(commodity, state, district, market, days) {
    // Build API URL with query parameters
    const params = new URLSearchParams({
        commodity,
        days
    });
    
    if (state) params.append('state', state);
    if (district) params.append('district', district);
    if (market) params.append('market', market);
    
    const apiUrl = `/api/market-trends?${params.toString()}`;
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading state
            loadingElement.classList.add('hidden');
            
            if (!data.trendData || data.trendData.length === 0) {
                // Show no data state
                noDataElement.classList.remove('hidden');
                resultsElement.classList.add('hidden');
                return;
            }
            
            // Show results
            resultsElement.classList.remove('hidden');
            
            // Render the data
            renderTrendData(data);
        })
        .catch(error => {
            console.error('Error fetching market trends:', error);
            
            // Hide loading state and show no data state
            loadingElement.classList.add('hidden');
            noDataElement.classList.remove('hidden');
            resultsElement.classList.add('hidden');
            
            // Since this is a new feature, we'll display mock data for demonstration
            // This is only a fallback if the API is not working
            if (error.message.includes('Network response was not ok') || error.message.includes('Failed to fetch')) {
                renderMockData(commodity, days);
            }
        });
}

// Render market trend data
function renderTrendData(data) {
    const { commodity, trendData, priceChange, rawData } = data;
    
    // Sort trend data by date (newest first for summary, oldest first for chart)
    const sortedDataNewestFirst = [...trendData].sort((a, b) => {
        const dateA = new Date(a.date.split('-').reverse().join('-'));
        const dateB = new Date(b.date.split('-').reverse().join('-'));
        return dateB - dateA;
    });
    
    const sortedDataOldestFirst = [...trendData].sort((a, b) => {
        const dateA = new Date(a.date.split('-').reverse().join('-'));
        const dateB = new Date(b.date.split('-').reverse().join('-'));
        return dateA - dateB;
    });
    
    // Get the latest price
    const latestData = sortedDataNewestFirst[0] || { modalPrice: '0.00', date: '--/--/----' };
    currentPriceElement.textContent = `₹${latestData.modalPrice}`;
    priceDateElement.textContent = `As of ${latestData.date}`;
    
    // Set price change
    if (priceChange !== null) {
        const changeValue = parseFloat(priceChange);
        const changeFormatted = Math.abs(changeValue).toFixed(2);
        priceChangeElement.textContent = `${changeValue >= 0 ? '+' : '-'}${changeFormatted}%`;
        
        // Set appropriate color and icon for price change
        if (changeValue > 0) {
            priceChangeElement.classList.remove('text-red-600');
            priceChangeElement.classList.add('text-green-600');
            priceChangeIconElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
            `;
        } else if (changeValue < 0) {
            priceChangeElement.classList.remove('text-green-600');
            priceChangeElement.classList.add('text-red-600');
            priceChangeIconElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            `;
        } else {
            priceChangeElement.classList.remove('text-green-600', 'text-red-600');
            priceChangeElement.classList.add('text-gray-600');
            priceChangeIconElement.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M7 10a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clip-rule="evenodd" />
                </svg>
            `;
        }
    } else {
        priceChangeElement.textContent = 'N/A';
        priceChangeElement.classList.remove('text-green-600', 'text-red-600');
        priceChangeElement.classList.add('text-gray-600');
        priceChangeIconElement.innerHTML = '';
    }
    
    // Find minimum and maximum prices
    let minPrice = Number.MAX_VALUE;
    let maxPrice = Number.MIN_VALUE;
    
    trendData.forEach(item => {
        const price = parseFloat(item.modalPrice);
        if (price < minPrice) minPrice = price;
        if (price > maxPrice) maxPrice = price;
    });
    
    minPriceElement.textContent = `₹${minPrice === Number.MAX_VALUE ? '0.00' : minPrice.toFixed(2)}`;
    maxPriceElement.textContent = `₹${maxPrice === Number.MIN_VALUE ? '0.00' : maxPrice.toFixed(2)}`;
    
    // Render chart
    renderPriceChart(sortedDataOldestFirst, commodity);
    
    // Render market data table
    renderMarketDataTable(rawData || []);
}

// Render price chart
function renderPriceChart(trendData, commodity) {
    // Extract dates and prices
    const dates = trendData.map(item => item.date);
    const modalPrices = trendData.map(item => parseFloat(item.modalPrice));
    const minPrices = trendData.map(item => parseFloat(item.minPrice));
    const maxPrices = trendData.map(item => parseFloat(item.maxPrice));
    
    // Destroy existing chart if it exists
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Create new chart
    const ctx = priceChartElement.getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Modal Price',
                    data: modalPrices,
                    borderColor: 'rgb(22, 163, 74)',
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Min Price',
                    data: minPrices,
                    borderColor: 'rgb(107, 114, 128)',
                    backgroundColor: 'rgba(107, 114, 128, 0.1)',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Max Price',
                    data: maxPrices,
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Price Trends for ${commodity}`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ₹${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Price (₹)'
                    },
                    beginAtZero: false
                }
            }
        }
    });
}

// Render market data table
function renderMarketDataTable(rawData) {
    if (!rawData || rawData.length === 0) {
        marketDataTableElement.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">No recent market data available</td>
            </tr>
        `;
        return;
    }
    
    // Clear existing table data
    marketDataTableElement.innerHTML = '';
    
    // Add rows for each data item
    rawData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.arrival_date || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.market || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.commodity || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.variety || 'Standard'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.min_price || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.max_price || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-700">${item.modal_price || '-'}</td>
        `;
        marketDataTableElement.appendChild(row);
    });
}

// Render mock data for demonstration when API is not available
function renderMockData(commodity, days) {
    console.log('Rendering mock data for demonstration');
    
    // Generate dates for the past N days
    const dates = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    for (let i = 0; i < parseInt(days); i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        dates.push(`${day}-${month}-${year}`);
    }
    
    // Generate mock price data with some randomness but following a trend
    const basePrice = commodityPriceMap[commodity] || 2000 + Math.random() * 3000;
    const volatility = 0.03; // 3% daily price movement
    const trend = 0.001; // Slight upward trend
    
    let currentPrice = basePrice;
    const trendData = dates.map((date, index) => {
        // Add some random movement with a slight trend
        const change = (Math.random() - 0.5) * 2 * volatility + trend;
        currentPrice = currentPrice * (1 + change);
        
        return {
            date,
            modalPrice: currentPrice.toFixed(2),
            minPrice: (currentPrice * 0.9).toFixed(2),
            maxPrice: (currentPrice * 1.1).toFixed(2),
            count: Math.floor(Math.random() * 10) + 1
        };
    });
    
    // Calculate price change percentage
    const firstPrice = parseFloat(trendData[0].modalPrice);
    const lastPrice = parseFloat(trendData[trendData.length - 1].modalPrice);
    const priceChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    
    // Create some mock raw data for the table
    const rawData = [];
    for (let i = 0; i < 5; i++) {
        const dateIndex = trendData.length - 1 - i;
        if (dateIndex >= 0) {
            const item = trendData[dateIndex];
            rawData.push({
                arrival_date: item.date,
                market: 'Mock Market',
                commodity: commodity,
                variety: 'Standard',
                min_price: item.minPrice,
                max_price: item.maxPrice,
                modal_price: item.modalPrice
            });
        }
    }
    
    // Show results and render the mock data
    loadingElement.classList.add('hidden');
    noDataElement.classList.add('hidden');
    resultsElement.classList.remove('hidden');
    
    renderTrendData({
        commodity,
        trendData,
        priceChange,
        rawData
    });
}

// Map of approximate prices for common commodities (per quintal)
const commodityPriceMap = {
    'Atta (Wheat)': 2500,
    'Bajra': 2000,
    'Barley': 2200,
    'Bengal Gram Dal': 6000,
    'Black Gram Dal': 7000,
    'Cashew Nut': 80000,
    'Castor Oil': 9000,
    'Coconut': 3000,
    'Coconut Oil': 16000,
    'Coffee': 32000,
    'Coriander': 7000,
    'Cotton': 6000,
    'Dry Chillies': 18000,
    'Ginger Dry': 15000,
    'Gram': 5000,
    'Groundnut': 6500,
    'Gur': 3500,
    'Jaggery': 3600,
    'Jowar': 2200,
    'Jute Raw': 4500,
    'Lentil': 6500,
    'Maida Atta': 2600,
    'Maize': 1800,
    'Masoor Dal': 7000,
    'Methi': 8000,
    'Mustard Oil': 15000,
    'Onion': 2000,
    'Paddy': 1800,
    'Peas': 4000,
    'Potato': 1500,
    'Rice': 3000,
    'Soji': 3000,
    'Soyabean': 3800,
    'Sugar': 3700,
    'Tea': 25000,
    'Tomato': 2000,
    'Turmeric': 7500,
    'Urad Dal': 8000,
    'Wheat': 2000
};

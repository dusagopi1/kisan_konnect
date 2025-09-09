// Load locations data (states and districts)
document.addEventListener('DOMContentLoaded', () => {
    // Find state and district select elements (handle both standard and filter element IDs)
    const stateSelect = document.getElementById('state') || document.getElementById('state-filter');
    const districtSelect = document.getElementById('district') || document.getElementById('district-filter');
    
    if (!stateSelect || !districtSelect) return; // Exit if elements not found
    
    // Fetch the locations data
    fetch('/data/locations.json')
        .then(response => response.json())
        .then(data => {
            // Populate states dropdown
            data.states.forEach(state => {
                const option = document.createElement('option');
                option.value = state.name;
                option.textContent = state.name;
                stateSelect.appendChild(option);
            });
            
            // Update districts when state changes
            stateSelect.addEventListener('change', () => {
                const selectedState = stateSelect.value;
                districtSelect.innerHTML = '<option value="">Select District</option>';
                districtSelect.disabled = !selectedState;
                
                if (selectedState) {
                    const state = data.states.find(s => s.name === selectedState);
                    if (state && state.districts) {
                        state.districts.forEach(district => {
                            const option = document.createElement('option');
                            option.value = district;
                            option.textContent = district;
                            districtSelect.appendChild(option);
                        });
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error loading locations data:', error);
            // Add fallback options if data fails to load
            const defaultStates = ["Andhra Pradesh", "Karnataka", "Maharashtra", "Tamil Nadu", "Telangana"];
            defaultStates.forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                stateSelect.appendChild(option);
            });
        });
});

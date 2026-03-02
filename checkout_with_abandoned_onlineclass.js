/*
Purpose: Full checkout experience with abandoned-cart recovery plus briefs upsell modal management.

Brief Logic: Handles abandoned cart recovery by checking localStorage and API for saved carts. Manages briefs upsell modal display and integrates selected briefs into checkout flow with dynamic total updates.

Are there any dependent JS files: No
*/

/**
 *
 * @param name - HTML element name
 * @param className - HTML element class attribute
 * @param idName - HTML element id attribute
 */
// Creates a DOM element with optional class and id attributes
function creEl(name, className, idName) {
	var el = document.createElement(name);
	if (className) {
		el.className = className;
	}
	if (idName) {
		el.setAttribute("id", idName);
	}
	return el;
}
class BriefsUpsellModal {
	// Initializes BriefsUpsellModal instance and sets up brief events modal
	constructor() {
		this.modal = document.getElementById('briefs-upsell-modal');
		this.modalBg = document.getElementById('briefs-upsell-modal-bg');
		this.modalContainer = document.getElementById('briefs-upsell-modal-container');
		this.modalClose = document.getElementById('briefs-modal-close');
		this.briefEventsContainers = Array.from(document.querySelectorAll('[data-cart="briefEvents-container"]'));
		this.briefEventsContainer = this.briefEventsContainers[0] || null;
		this.setSelectedBriefEventsWrappers();
		this.briefCtaButtons = Array.from(document.querySelectorAll('[data-cart="add-brief-event"]'));
		this.briefCtaButton = this.briefCtaButtons[0] || null;
		this.briefCtaDefaultDisplay = this.briefCtaButton ? this.briefCtaButton.style.display : '';
		this.briefCtaDefaultDisplays = new Map();
		this.briefCtaDefaultStyles = new Map();
		this.briefCtaButtons.forEach((button) => {
			this.briefCtaDefaultDisplays.set(button, button.style.display || '');
			// Store original styles for restoration
			this.briefCtaDefaultStyles.set(button, {
				pointerEvents: button.style.pointerEvents || '',
				color: button.style.color || '',
				backgroundColor: button.style.backgroundColor || ''
			});
		});
		this.briefCheckboxIcons = {
			checked: 'https://cdn.prod.website-files.com/6271a4bf060d543533060f47/691ecbd882b2c55efd083770_square-check%20(2).svg',
			unchecked: 'https://cdn.prod.website-files.com/6271a4bf060d543533060f47/691ec94934f1278c4ad69157_square-check.svg'
		};
		this.briefEvents = [];
		this.debateEventId = null;
		this.selectedBriefEvent = null;
		this.appliedBriefEvent = null;
		this.briefEventAdded = false;
		this.briefSelectionFromStorage = null;
		this.briefSelectionRestored = false;
		this.briefTotalsRestored = false;
		this.bindBriefModalCloseEvents();
		this.loadStoredBriefSelection();
	}
	// Shows the briefs upsell modal if user is admin and brief event not already added
	showBriefsUpsellModal() {
		console.log("showBriefsUpsellModal");
		if (!this.memberData || !this.memberData.isAdmin) {
			return;
		}
		if (!this.modal || !this.modalBg) {
			return;
		}
		if (this.briefEventAdded) {
			return;
		}
		this.modal.classList.add('show');
		this.modal.style.display = 'flex';
		this.modalBg.setAttribute('aria-hidden', 'false');
	}
	// Hides the briefs upsell modal and updates aria attributes
	hideBriefsUpsellModal() {
		console.log("hideBriefsUpsellModal");
		if (!this.modal || !this.modalBg) {
			return;
		}
		this.modal.classList.remove('show');
		this.modal.style.display = 'none';
		this.modalBg.removeAttribute('aria-hidden');
	}
	// Binds event handlers for closing the briefs modal via close button or background click
	bindBriefModalCloseEvents() {
		console.log("bindBriefModalCloseEvents");
		if (this.modalClose) {
			this.modalClose.addEventListener('click', (event) => {
				event.preventDefault();
				this.hideBriefsUpsellModal();
			});
		}
		if (this.modalBg) {
			this.modalBg.addEventListener('click', () => this.hideBriefsUpsellModal());
		}
	}
	// Binds event handlers to brief CTA buttons for adding brief events to cart
	bindBriefCtaButton() {
		console.log("bindBriefCtaButton");
		console.log("Binding brief CTA buttons");
		if (!this.briefCtaButtons || !this.briefCtaButtons.length) {
			//console.log("No brief CTA buttons found to bind");
			return;
		}
		this.briefCtaButtons.forEach((button) => {
			if (button.dataset.briefCtaBound === 'true') {
				//console.log("Brief CTA button already bound, skipping:", button);
				return;
			}
			button.dataset.briefCtaBound = 'true';
			button.addEventListener('click', (event) => {
				event.preventDefault();
				// If no brief event is selected, select the debateEventId
				if (!this.selectedBriefEvent && this.debateEventId) {
					//console.log("No brief selected, selecting debateEventId:", this.debateEventId);
					this.selectBriefEvent(this.debateEventId);
				}
				if (this.selectedBriefEvent) {
                    //this.appliedBriefEvent = this.selectedBriefEvent;
					this.updateBriefAmount(this.selectedBriefEvent);
					this.renderSelectedBriefSummary();
					this.briefEventAdded = true;
					this.hideBriefsUpsellModal();
					this.persistBriefSelection(this.selectedBriefEvent);
					this.briefSelectionRestored = true;
					// Update button text to "Added" after clicking and disable it
					this.briefCtaButtons.forEach((btn) => {
						btn.textContent = 'Added';
						// Disable button when text is "Added"
						btn.style.pointerEvents = 'none';
						btn.style.color = 'rgb(255, 255, 255)';
						btn.style.backgroundColor = 'gray';
					});
				}
			});
		});
	}
	// Initializes the briefs upsell modal by caching elements and fetching brief events
	initializeBriefsUpsellModal() {
		console.log("initializeBriefsUpsellModal");
		if (!this.memberData || !this.memberData.isAdmin) {
			return;
		}
		this.cacheBriefModalElements();
		this.bindBriefModalCloseEvents();
		this.bindBriefCtaButton();
		this.updateBriefCtaState();
		this.fetchBriefEvents();
	}
	// Caches brief modal DOM elements and stores default button styles
	cacheBriefModalElements() {
		console.log("cacheBriefModalElements");
		this.briefEventsContainers = Array.from(document.querySelectorAll('[data-cart="briefEvents-container"]'));
		this.briefEventsContainer = this.briefEventsContainers[0] || null;
		this.setSelectedBriefEventsWrappers();
		this.briefCtaButtons = Array.from(document.querySelectorAll('[data-cart="add-brief-event"]'));
		this.briefCtaButton = this.briefCtaButtons[0] || null;
		if (!this.briefCtaDefaultDisplays) {
			this.briefCtaDefaultDisplays = new Map();
		}
		this.briefCtaButtons.forEach((button) => {
			if (!this.briefCtaDefaultDisplays.has(button)) {
				this.briefCtaDefaultDisplays.set(button, button.style.display || '');
			}
			if (!this.briefCtaDefaultStyles) {
				this.briefCtaDefaultStyles = new Map();
			}
			if (!this.briefCtaDefaultStyles.has(button)) {
				this.briefCtaDefaultStyles.set(button, {
					pointerEvents: button.style.pointerEvents || '',
					color: button.style.color || '',
					backgroundColor: button.style.backgroundColor || ''
				});
			}
		});
		if (this.briefCtaButton && !this.briefCtaDefaultDisplay) {
			this.briefCtaDefaultDisplay = this.briefCtaButton.style.display || '';
		}
	}
	// Sets the selected brief events wrapper elements from DOM
	setSelectedBriefEventsWrappers() {
		console.log("setSelectedBriefEventsWrappers");
		this.selectedBriefEventsWrappers = Array.from(document.querySelectorAll('.selected_brief_events'));
		this.selectedBriefEventsWrapper = this.selectedBriefEventsWrappers[0] || null;
	}
	// Returns array of selected brief events wrapper elements
	getSelectedBriefEventsWrappers() {
		console.log("getSelectedBriefEventsWrappers");
		if (Array.isArray(this.selectedBriefEventsWrappers) && this.selectedBriefEventsWrappers.length) {
			return this.selectedBriefEventsWrappers;
		}
		return this.selectedBriefEventsWrapper ? [this.selectedBriefEventsWrapper] : [];
	}
	// Fetches brief events from API and renders them in the modal
	async fetchBriefEvents() {
		 console.log("fetchBriefEvents");
		if (typeof this.fetchData !== 'function') {
			return;
		}
		try {
			// getBriefDetails API call removed; use empty data so briefs UI still runs
			const response = { briefEvents: [], debateEventId: null };
			const events = [];
			this.briefEvents = events.sort((a, b) => {
				const aOrder = typeof a.displayOrder === 'number' ? a.displayOrder : 0;
				const bOrder = typeof b.displayOrder === 'number' ? b.displayOrder : 0;
				return aOrder - bOrder;
			});
			this.debateEventId = response.debateEventId;
			this.renderBriefEvents();
		} catch (error) {
			console.error('Error fetching brief events:', error);
			this.renderBriefEventsError();
		}
	}
	// Renders brief events as cards in the modal containers
	renderBriefEvents() {
		console.log("renderBriefEvents");
		const containers = this.getBriefEventsContainers();

		if (!containers.length) {
			return;
		}
		const unavailableMarkup =
			'<p class="dm-sans center-text-small">Brief events are currently unavailable.</p>';
		containers.forEach((container) => {
			container.innerHTML = '';
			if (!this.briefEvents.length) {
				container.innerHTML = unavailableMarkup;
				return;
			}
			const fragment = document.createDocumentFragment();
			this.briefEvents.forEach((briefEvent) => {
				const card = document.createElement('div');
				//card.className = 'debate-season-discount-price-info';
				/*if (briefEvent.highlighted) {
					card.classList.add('selected-red');
				}*/
				card.setAttribute('data-brief-event-id', briefEvent.eventId);
				card.setAttribute('data-brief-event-title', briefEvent.title || '');
				card.innerHTML = this.buildBriefEventMarkup(briefEvent);
				fragment.appendChild(card);
			});
			container.appendChild(fragment);
		});
		this.bindBriefEventCards();
		this.syncBriefCardsWithSelection();
		this.restoreBriefSelectionFromStorage();
		this.filterBriefEventsByDebateId();
	}
	// Renders error message when brief events fail to load
	renderBriefEventsError() {
		console.log("renderBriefEventsError");
		const containers = this.getBriefEventsContainers();
		if (!containers.length) {
			return;
		}
		const errorMarkup =
			'<p class="dm-sans center-text-small">Unable to load brief events right now. Please try again later.</p>';
		containers.forEach((container) => {
			container.innerHTML = errorMarkup;
		});
	}
	// Filters brief event elements to show only the one matching debateEventId
	filterBriefEventsByDebateId() {
		console.log("filterBriefEventsByDebateId");
		if (!this.debateEventId) {
			//console.log("No debateEventId provided, skipping brief event filtering");
			return;
		}
		// Find all elements with data-brief-event-id attribute in the entire document
		const allElements = document.querySelectorAll('[data-brief-event-id]');
		allElements.forEach((element) => {
			const eventId = element.getAttribute('data-brief-event-id');
			if (eventId === String(this.debateEventId)) {
				element.style.display = '';
				//console.log("Showing brief event with ID:", eventId);
			} else {
				element.style.display = 'none';
			}
		});
	}
	// Builds HTML markup for a single brief event card
	buildBriefEventMarkup(briefEvent) {
		console.log("buildBriefEventMarkup");
		const price = this.formatCurrency(briefEvent.price);
		//console.log("Price", price);
		const savedAmount = parseFloat(briefEvent.saved_amount || 0);
		//console.log("Saved Amount", savedAmount);
		let cleanPrice = parseFloat(price.replace('$', ''));
        let total = cleanPrice + Number(savedAmount);
		//console.log("Total", total);
		const description = briefEvent.description || '';
		return `
		     	<div class="bundle-info-flex">
				<div class="bundle-checkbox-wrapper hide" aria-hidden="true">
					<img src="${this.briefCheckboxIcons.unchecked}" class="bundle-checkbox" alt="">
				</div>
			</div>
		     <div class="season-header"><div class="debate-season-title"><span>Next Season</span><br></div><div class="debate-season-sub-title"><span>${description}</span><br></div></div> 
             <div data-brief-event-title="LD Annual" class="debate-season-discount-price-info"><img src="https://cdn.prod.website-files.com/6271a4bf060d543533060f47/6981fb3eb1bacc158e3abf16_Group%2019354.svg" loading="lazy" alt="" class="debate-season-icon"><div><div class="debate-season-info-flex"><div><div class="debate-season-orig-price"> $${total}
             </div></div><div class="dm-sans bundle"><strong class="price-text-red">${price}</strong><span>/Year</span><br></div><div class="save-price">Save ${this.formatCurrency(savedAmount)}<br></div></div></div></div>
		`;
	}
	// Formats a numeric amount as currency string with dollar sign
	formatCurrency(amount) {
		console.log("formatCurrency");
		const numericAmount = parseFloat(typeof amount !== 'undefined' && amount !== null ? amount : 0) || 0;
		const formatted = this.numberWithCommas
			? this.numberWithCommas(numericAmount.toFixed(2))
			: numericAmount.toFixed(2);
		return `$${formatted}`;
	}
	// Binds click event handlers to brief event cards for selection
	bindBriefEventCards() {
		console.log("bindBriefEventCards");
		const containers = this.getBriefEventsContainers();
		if (!containers.length) {
			return;
		}
		containers.forEach((container) => {
			const cards = container.querySelectorAll('[data-brief-event-id]');
			cards.forEach((card) => {
				card.addEventListener('click', (event) => {
					event.preventDefault();
					const briefId = card.getAttribute('data-brief-event-id');
					if (!briefId) {
						return;
					}
					//this.selectBriefEvent(briefId);
				});
			});
		});
	}
	// Selects a brief event by ID and updates UI state
	selectBriefEvent(eventId) {
		console.log("selectBriefEvent");
		const selected = this.briefEvents.find(
			(event) => String(event.eventId) === String(eventId)
		);
		if (!selected) {
			return;
		}
		this.selectedBriefEvent = selected;
		this.syncBriefCardsWithSelection();
		// Check if selected brief matches the applied brief
		if (this.appliedBriefEvent) {
			const isSameBrief = String(this.appliedBriefEvent.eventId) === String(selected.eventId);
			this.briefEventAdded = isSameBrief;
		} else {
			this.briefEventAdded = false;
		}
		this.updateBriefCtaState();
	}
	// Updates the total amount when a brief event is selected or changed
	updateBriefAmount(nextSelection) {
		console.log("updateBriefAmount");
		const totalAmountInput = document.getElementById('totalAmount');
		if (!totalAmountInput) {
			return;
		}
		const currentBriefAmount = parseFloat(
			this.appliedBriefEvent && this.appliedBriefEvent.price ? this.appliedBriefEvent.price : 0
		) || 0;
		const nextBriefAmount = parseFloat(nextSelection && nextSelection.price ? nextSelection.price : 0) || 0;
		const updatedAmount = (parseFloat(totalAmountInput.value) || 0) - currentBriefAmount + nextBriefAmount;
		totalAmountInput.value = updatedAmount;
		this.appliedBriefEvent = nextSelection || null;
		if (typeof this.updateOnlyTotalAmount === 'function') {
			this.updateOnlyTotalAmount();
		}
		this.refreshTotalPriceVisibility();
	}
	// Synchronizes brief event card visual state with current selection
	syncBriefCardsWithSelection() {
		console.log("syncBriefCardsWithSelection");
		const containers = this.getBriefEventsContainers();
		if (!containers.length) {
			return;
		}
		const selectedId = this.selectedBriefEvent ? this.selectedBriefEvent.eventId : null;
		containers.forEach((container) => {
			const cards = container.querySelectorAll('[data-brief-event-id]');
			cards.forEach((card) => {
				const cardId = card.getAttribute('data-brief-event-id');
				const isSelected = selectedId && String(cardId) === String(selectedId);
				card.classList.toggle('brief-card-selected', Boolean(isSelected));
				//card.classList.toggle('selected-red', Boolean(isSelected));
				const checkboxIcon = card.querySelector('.bundle-checkbox');
				if (checkboxIcon) {
					checkboxIcon.classList.toggle('checked', Boolean(isSelected));
					checkboxIcon.setAttribute(
						'src',
						isSelected ? this.briefCheckboxIcons.checked : this.briefCheckboxIcons.unchecked
					);
				}
			});
		});
	}
	// Renders the selected brief event summary in the sidebar
	renderSelectedBriefSummary() {
		this.setSelectedBriefEventsWrappers();
		const wrappers = this.getSelectedBriefEventsWrappers();
		if (!wrappers.length) {
			return;
		}
		wrappers.forEach((wrapperEl) => {
			wrapperEl.innerHTML = '';
		});
		if (!this.selectedBriefEvent) {
			return;
		}
		wrappers.forEach((wrapperEl) => {
			const fragment = this.buildSelectedBriefSummaryFragment();
			wrapperEl.appendChild(fragment);
		});
	}
	// Builds DOM fragment for selected brief event summary with remove button
	buildSelectedBriefSummaryFragment() {
		const fragment = document.createDocumentFragment();
		const format = this.extractBriefFormat(this.selectedBriefEvent.title);
		const freeBriefName = `NSD Briefs 2025-2026 (${format})`;
		const paidBriefName = `NSD Briefs 2026-2027 (${format})`;

		const headingContainer = creEl('div', 'horizontal-div supp-program');
		const headingLabel = creEl('p', 'dm-sans bold-700');
		headingLabel.textContent = 'NSD Briefs';
		headingContainer.prepend(headingLabel);
		fragment.appendChild(headingContainer);

		const wrapper = creEl('div', 'selected-brief-event');
		const row = creEl('div', 'horizontal-div align-left brief-summary-row');
		const infoContainer = creEl('div', 'horizontal-div supplementary');

		const offeringType = creEl('div', 'dm-sans offering-type selected-brief-names');
		const freeLabel = creEl('p', 'dm-sans');
		freeLabel.textContent = freeBriefName;
		const paidLabel = creEl('p', 'dm-sans');
		paidLabel.textContent = paidBriefName;
		offeringType.append(freeLabel, paidLabel);

		const offeringRemove = creEl('div', 'dm-sans offering-remove brief-remove-btn');
		offeringRemove.setAttribute('data-brief-action', 'remove');
		offeringRemove.setAttribute('role', 'button');
		offeringRemove.setAttribute('tabindex', '0');
		offeringRemove.textContent = 'Remove';
		infoContainer.prepend(offeringType, offeringRemove);

		const offeringPrice = creEl('div', 'dm-sans offering-price');
		offeringPrice.textContent = this.formatCurrency(this.selectedBriefEvent.price);
		const offeringPriceFree = creEl('div', 'dm-sans offering-price');
		offeringPriceFree.textContent = 'FREE';
		offeringPrice.prepend(offeringPriceFree);
		row.prepend(infoContainer, offeringPrice);
		wrapper.appendChild(row);

		fragment.appendChild(wrapper);

		const removeBtn = wrapper.querySelector('[data-brief-action="remove"]');
		if (removeBtn) {
			const handleRemove = (event) => {
				event.preventDefault();
				this.clearBriefSelection();
				//this.selectBriefEvent(this.debateEventId);
			};
			removeBtn.addEventListener('click', handleRemove);
			removeBtn.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					handleRemove(event);
				}
			});
		}
		return fragment;
	}
	// Extracts brief format (LD, PF, or LD + PF) from brief event title
	extractBriefFormat(title) {
		if (!title) {
			return '';
		}
		const titleUpper = title.toUpperCase();
		if (titleUpper.includes('LD + PF') || titleUpper.includes('LD+PF') || titleUpper.includes('BUNDLE')) {
			return 'LD + PF';
		}
		if (titleUpper.includes('PF')) {
			return 'PF';
		}
		if (titleUpper.includes('LD')) {
			return 'LD';
		}
		return title;
	}
	// Updates brief CTA button visibility and text based on selection state
	updateBriefCtaState() {
		if (!this.briefCtaButtons || !this.briefCtaButtons.length) {
			return;
		}
		// Always show the button
		this.briefCtaButtons.forEach((button) => {
			const defaultDisplay = this.briefCtaDefaultDisplays
				? this.briefCtaDefaultDisplays.get(button)
				: this.briefCtaDefaultDisplay;
			button.style.display = defaultDisplay || '';
			// Update button text based on state
			// Check if selected brief matches applied brief
			const isSameBrief = this.appliedBriefEvent && this.selectedBriefEvent &&
				String(this.appliedBriefEvent.eventId) === String(this.selectedBriefEvent.eventId);
			
			if (isSameBrief) {
				// Selected brief is the same as applied brief - show "Added" and disable
				button.textContent = 'Added';
				button.style.pointerEvents = 'none';
				button.style.color = 'rgb(255, 255, 255)';
				button.style.backgroundColor = 'gray';
			} else {
				// Restore original styles when not "Added"
				const defaultStyles = this.briefCtaDefaultStyles ? this.briefCtaDefaultStyles.get(button) : null;
				if (defaultStyles) {
					button.style.pointerEvents = defaultStyles.pointerEvents || '';
					button.style.color = defaultStyles.color || '';
					button.style.backgroundColor = defaultStyles.backgroundColor || '';
				} else {
					// Reset to default if no stored styles
					button.style.pointerEvents = '';
					button.style.color = '';
					button.style.backgroundColor = '';
				}
				
				if (this.appliedBriefEvent) {
					// Different brief is applied - show "Switch Bundle"
					button.textContent = 'Switch Bundle';
				} else {
					// No brief applied yet - show "Add to Cart"
					button.textContent = 'Add to Cart';
				}
			}
		});
	}
	// Clears the selected brief event and updates total amount
	clearBriefSelection() {
		if (!this.selectedBriefEvent && !this.appliedBriefEvent) {
			return;
		}
		const totalAmountInput = document.getElementById('totalAmount');
		if (totalAmountInput) {
			const currentAmount = parseFloat(totalAmountInput.value) || 0;
			const appliedSelection = this.appliedBriefEvent || this.selectedBriefEvent;
			if (appliedSelection) {
				const updatedAmount = currentAmount - (parseFloat(appliedSelection.price) || 0);
				totalAmountInput.value = updatedAmount < 0 ? 0 : updatedAmount;
				if (typeof this.updateOnlyTotalAmount === 'function') {
					this.updateOnlyTotalAmount();
				}
			}
		}
		this.appliedBriefEvent = null;
		this.selectedBriefEvent = null;
		this.briefEventAdded = false;
		this.setSelectedBriefEventsWrappers();
		this.getSelectedBriefEventsWrappers().forEach((wrapperEl) => {
			wrapperEl.innerHTML = '';
		});
		this.syncBriefCardsWithSelection();
		// Reset button text to "Add to Cart" and restore styles when clearing selection
		this.briefCtaButtons.forEach((button) => {
			button.textContent = 'Add to Cart';
			// Restore original styles
			const defaultStyles = this.briefCtaDefaultStyles ? this.briefCtaDefaultStyles.get(button) : null;
			if (defaultStyles) {
				button.style.pointerEvents = defaultStyles.pointerEvents || '';
				button.style.color = defaultStyles.color || '';
				button.style.backgroundColor = defaultStyles.backgroundColor || '';
			} else {
				// Reset to default if no stored styles
				button.style.pointerEvents = '';
				button.style.color = '';
				button.style.backgroundColor = '';
			}
		});
		this.updateBriefCtaState();
		this.persistBriefSelection(null);
		this.briefTotalsRestored = false;
		this.refreshTotalPriceVisibility();
	}
	// Loads stored brief selection from localStorage
	loadStoredBriefSelection() {
		if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
			return;
		}
		try {
			const stored = localStorage.getItem('checkOutData');
			if (!stored) {
				return;
			}
			const parsed = JSON.parse(stored);
			if (parsed && parsed.briefEvent) {
				this.briefSelectionFromStorage = parsed.briefEvent;
			}
		} catch (error) {
			console.warn('Unable to parse stored brief selection:', error);
		}
	}
	// Persists brief selection to localStorage and checkout data
	persistBriefSelection(selection) {
		if (typeof window === 'undefined') {
			return;
		}
		const payload = selection
			? { briefEvent: selection, briefEventIds: this.getSelectedBriefEventIds() }
			: { briefEvent: null, briefEventIds: [] };
		if (typeof this.updateCheckOutData === 'function') {
			this.updateCheckOutData(payload);
		} else if (typeof localStorage !== 'undefined') {
			try {
				const existing = localStorage.getItem('checkOutData');
				const merged = existing ? { ...JSON.parse(existing), ...payload } : payload;
				localStorage.setItem('checkOutData', JSON.stringify(merged));
			} catch (error) {
				console.warn('Unable to persist brief selection:', error);
			}
		}
		this.briefSelectionFromStorage = selection || null;
	}
	// Restores brief selection from localStorage and applies it to the UI
	restoreBriefSelectionFromStorage() {
		if (this.briefSelectionRestored || !this.briefSelectionFromStorage) {
			return;
		}
		const storedMatch = this.findStoredBriefSelectionMatch();
		if (!storedMatch) {
			this.briefSelectionRestored = true;
			return;
		}
		this.selectedBriefEvent = storedMatch;
		this.briefEventAdded = true;
		this.renderSelectedBriefSummary();
		this.ensureBriefTotalsApplied(storedMatch);
		this.syncBriefCardsWithSelection();
		this.updateBriefCtaState();
		this.briefSelectionRestored = true;
	}
	// Finds matching brief event from loaded events based on stored selection
	findStoredBriefSelectionMatch() {
		if (!this.briefSelectionFromStorage) {
			return null;
		}
		const storedId = this.briefSelectionFromStorage.eventId;
		if (storedId && Array.isArray(this.briefEvents) && this.briefEvents.length) {
			const matched = this.briefEvents.find(
				(event) => String(event.eventId) === String(storedId)
			);
			if (matched) {
				return matched;
			}
		}
		return this.briefSelectionFromStorage;
	}
	// Ensures brief event price is added to total amount when restoring from storage
	ensureBriefTotalsApplied(selection) {
		if (this.briefTotalsRestored) {
			return;
		}
		const totalAmountInput = document.getElementById('totalAmount');
		if (!totalAmountInput || !selection) {
			return;
		}
		const currentTotal = parseFloat(totalAmountInput.value) || 0;
		const briefPrice = parseFloat(selection.price) || 0;
		totalAmountInput.value = (currentTotal + briefPrice).toFixed(2);
		this.appliedBriefEvent = selection;
		if (typeof this.updateOnlyTotalAmount === 'function') {
			this.updateOnlyTotalAmount();
		}
		this.refreshTotalPriceVisibility();
		this.briefTotalsRestored = true;
	}
	// Returns array of selected brief event IDs
	getSelectedBriefEventIds() {
		if (!this.selectedBriefEvent) {
			return [];
		}
		const ids = new Set();
		const selected = this.selectedBriefEvent;
		ids.add(selected.eventId);
		return Array.from(ids);
	}
	// Returns array of brief events container elements
	getBriefEventsContainers() {
		if (Array.isArray(this.briefEventsContainers) && this.briefEventsContainers.length) {
			return this.briefEventsContainers;
		}
		return this.briefEventsContainer ? [this.briefEventsContainer] : [];
	}
}

/**
 * CheckOutWebflow Class is used to intigrate with stripe payment.
 * In this API we pass baseUrl, memberData.
 * In this class we are manipulating student form and member data
 */

class CheckOutWebflow extends BriefsUpsellModal {
	$suppPro = [];
	$checkoutData = "";
	$checkOutResponse = false;
	$initCheckout = null;
	$selectedProgram = [];
	$isAboundedProgram = false;
	$onlineClassBasePrice = null;
	$selectedClassOfferingId = null;
	// Initializes CheckOutWebflow instance and sets up checkout flow
	constructor(apiBaseUrl, memberData) {
		super();
		console.log("[CheckOutWebflow] constructor called");
		this.baseUrl = apiBaseUrl;
		this.memberData = memberData || {};
		this.briefsUpsellEnabled = Boolean(this.memberData.isAdmin);
		if (this.memberData.productType === "online_class" && this.memberData.achAmount != null) {
			var base = parseFloat(String(this.memberData.achAmount).replace(/,/g, ""));
			if (!isNaN(base)) this.$onlineClassBasePrice = base;
		}
		this.toggleSeasonInfoVisibility();
		this.hidePayLaterTab();
		console.log("[CheckOutWebflow] about to call setupClassOfferingCardClicks");
		this.setupClassOfferingCardClicks();
		console.log("[CheckOutWebflow] setupClassOfferingCardClicks returned");
		if (this.briefsUpsellEnabled) {
			this.initializeBriefsUpsellModal();
		}
		this.renderPortalData();
		console.log("[CheckOutWebflow] constructor finished");
	}
	// Hides the Pay Later (Affirm / BNPL) tab – we do not offer pay later
	hidePayLaterTab() {
		console.log("hidePayLaterTab");
		var payLaterTab = document.querySelector("a.checkout-tab-link.pay-later, a.pay-later.new-checkout-tab-link, .pay-later.checkout-tab-link");
		if (payLaterTab) {
			payLaterTab.style.display = "none";
		}
	}
	// Stripe card fee: (amount + 0.30) / 0.971. Returns formatted $ string for display.
	formatOnlineClassDisplayPrice(baseAmount, isCreditCard) {
		console.log("formatOnlineClassDisplayPrice");
		if (baseAmount == null || isNaN(baseAmount)) return "$0.00";
		var amount = isCreditCard ? (baseAmount + 0.30) / 0.971 : baseAmount;
		return "$" + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
	// Called when payment tab is clicked; updates online-class order price and core_product_price.
	updateOnlineClassPriceForTab(tabEl) {
		console.log("updateOnlineClassPriceForTab");
		var isOnlineClass = (this.memberData || {}).productType === "online_class" || this.isOnlineClassPage();
		if (!isOnlineClass) return;
		if (this.$onlineClassBasePrice == null) {
			var coreInput = document.getElementById("core_product_price");
			if (coreInput && coreInput.value) {
				var parsed = parseFloat(String(coreInput.value).replace(/,/g, ""));
				if (!isNaN(parsed)) this.$onlineClassBasePrice = parsed;
			}
		}
		if (this.$onlineClassBasePrice == null) {
			var fromDetails = document.querySelector(".price-order-details");
			if (fromDetails && fromDetails.textContent) {
				var parsed = parseFloat(String(fromDetails.textContent).replace(/[$,]/g, ""));
				if (!isNaN(parsed)) this.$onlineClassBasePrice = parsed;
			}
		}
		if (this.$onlineClassBasePrice == null) {
			var ocPriceEl = document.querySelector(".oc-price") || document.querySelector("[class*='oc-price']");
			if (ocPriceEl && ocPriceEl.textContent) {
				var parsed = parseFloat(String(ocPriceEl.textContent).replace(/[$,]/g, ""));
				if (!isNaN(parsed)) this.$onlineClassBasePrice = parsed;
			}
		}
		if (this.$onlineClassBasePrice == null) {
			var selectedCard = document.querySelector(".checkout_offering-card-wrapper.selected") || document.querySelector("[data-class-offering-id].selected");
			if (selectedCard) {
				var dataPrice = selectedCard.getAttribute("data-price");
				if (dataPrice) {
					var parsed = parseFloat(String(dataPrice).replace(/[$,]/g, ""));
					if (!isNaN(parsed)) this.$onlineClassBasePrice = parsed;
				}
				if (this.$onlineClassBasePrice == null) {
					var priceEl = selectedCard.querySelector("[class*='price']");
					if (priceEl && priceEl.textContent) {
						var parsed = parseFloat(String(priceEl.textContent).replace(/[$,]/g, ""));
						if (!isNaN(parsed)) this.$onlineClassBasePrice = parsed;
					}
				}
			}
		}
		if (this.$onlineClassBasePrice == null) return;
		var isCreditCard = !!(tabEl && (tabEl.classList.contains("credit-card-tab") || (tabEl.querySelector && tabEl.querySelector(".credit-card-tab"))));
		var displayPrice = this.formatOnlineClassDisplayPrice(this.$onlineClassBasePrice, isCreditCard);
		var numericAmount = isCreditCard ? (this.$onlineClassBasePrice + 0.30) / 0.971 : this.$onlineClassBasePrice;
		var formattedValue = Number(numericAmount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		console.log("[price] displayPrice:", displayPrice, "formattedValue:", formattedValue);
		var coreInput = document.getElementById("core_product_price");
		if (coreInput) coreInput.value = formattedValue;
		var $this = this;
		function setOcPrice() {
			var el = document.querySelector(".oc-price") || document.querySelector("[class*='oc-price']");
			console.log("[price] .oc-price element found:", !!el, el ? el.className : "none");
			if (el) {
				el.textContent = displayPrice;
				console.log("[price] .oc-price updated to:", displayPrice);
			} else {
				var fallback = document.querySelector(".price-order-details");
				if (fallback) {
					fallback.textContent = displayPrice;
					console.log("[price] fallback .price-order-details updated to:", displayPrice);
				} else {
					console.log("[price] no .oc-price or .price-order-details found");
				}
			}
		}
		setOcPrice();
		setTimeout(setOcPrice, 100);
		setTimeout(setOcPrice, 300);
		// Make the order summary block visible
		var orderSummaryWrappers = document.querySelectorAll(".residential-order-summary-3");
		for (var o = 0; o < orderSummaryWrappers.length; o++) {
			var onlineProgram = orderSummaryWrappers[o].querySelector(".online-program.hide");
			if (onlineProgram) onlineProgram.classList.remove("hide");
		}
		if (typeof this.updateOnlyTotalAmount === "function") this.updateOnlyTotalAmount();
	}
	// Toggles visibility of season info wrapper based on admin status
	toggleSeasonInfoVisibility() {
		console.log("toggleSeasonInfoVisibility");
		const wrappers = document.querySelectorAll('.setup-season-info-wrapper');
		if (!wrappers || !wrappers.length) {
			return;
		}
		const isAdmin = Boolean(this.memberData && this.memberData.isAdmin);
		wrappers.forEach((wrapper) => {
			if (isAdmin) {
				wrapper.style.removeProperty('display');
				if (!wrapper.classList.contains('d-block')) {
					wrapper.classList.add('d-block');
				}
			} else {
				wrapper.style.display = 'none';
				wrapper.classList.remove('d-block');
			}
		});
	}
	// Creates HTML markup for supplementary program tags
	createTags(suppData) {
		console.log("createTags");
		var html = "";

		if (!suppData.tags) return html;

		html += '<div class="programe-tag__box">';
		suppData.tags.forEach(function (tag) {
			html += `<span class="pills" style="background: ${tag.color}">${tag.name}</span>`;
		});
		html += "</div>";

		return html;
	}

	// Creates DOM element for a single supplementary program cart item
	createCartList(suppData) {
		console.log("createCartList");
		var coreProductContainer = creEl("div", "core-product-container");
		var $this = this;

		// Creating checkbox for cart
		var coreCheckbox = creEl("div", "core-checkbox");
		var wCheckbox = creEl("label", "w-checkbox");
		var checkboxS = creEl("input", "w-checkbox-input core-checkbox suppCheckbox");
		checkboxS.type = "checkbox";
		checkboxS.name = "checkbox";
		checkboxS.value = suppData.amount;
		checkboxS.setAttribute("programDetailId", suppData.programDetailId);
		checkboxS.setAttribute("data-name", "Checkbox");
		checkboxS.addEventListener("change", function () {
			$this.updateAmount(this, suppData.amount);
		});
		wCheckbox.appendChild(checkboxS);
		var spantext = creEl("span", "core-checkbox-label w-form-label");
		wCheckbox.appendChild(spantext);
		coreCheckbox.appendChild(wCheckbox);

		// Create supplementary program tags
		var tags = this.createTags(suppData);
		var tagsWapper = creEl("div", "programe-tag__wrapper");
		tagsWapper.innerHTML = tags;

		// Creating heading for supplementary program heading
		var coreProductTitle = creEl("div", "core-product-title");
		var h1 = creEl("h1", "core-product-title-text");
		h1.innerHTML = suppData.label;
		// var div = creEl("div", "core-product-title-subtext");
		// div.innerHTML = suppData.desc;
		var div = creEl("div", "save_price");
		div.innerHTML = "Save $" + (suppData.disc_amount - suppData.amount).toFixed(2).toString();

		var mobileResponsiveHide = creEl("div", "mobile-responsive-hide");

		// Price text discount
		var productPriceTextDiscount = creEl("div", "strike_price");
		productPriceTextDiscount.innerHTML =
			"$" +
			suppData.disc_amount
			.toFixed(2)
			.toString()
			.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		mobileResponsiveHide.appendChild(productPriceTextDiscount);

		// Mobile responsive price text. it will display on mobile
		var productPriceText = creEl("div", "product-price-text");
		productPriceText.innerHTML =
			"$" +
			suppData.amount
			.toFixed(2)
			.toString()
			.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		mobileResponsiveHide.appendChild(productPriceText);
		coreProductTitle.prepend(tagsWapper, h1, div, mobileResponsiveHide);

		// price container
		var productPriceContainer = creEl("div", "product-price-container hide-mobile");

		// Price text discount
		var productPriceTextDiscount1 = creEl("div", "strike_price");
		productPriceTextDiscount1.innerHTML =
			"$" +
			suppData.disc_amount
			.toFixed(2)
			.toString()
			.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		productPriceContainer.appendChild(productPriceTextDiscount1);

		// Desktop responsive price text. it will display on mobile
		var productPriceText1 = creEl("div", "product-price-text");
		productPriceText1.innerHTML =
			"$" +
			suppData.amount
			.toFixed(2)
			.toString()
			.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		productPriceContainer.appendChild(productPriceText1);
		// append title , price and checkbox
		coreProductContainer.prepend(coreProductTitle, productPriceContainer, coreCheckbox);

		return coreProductContainer;
	}
	// Formats a number with comma separators for thousands
	numberWithCommas(x) {
		console.log("numberWithCommas");
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	// Displays selected supplementary programs in desktop and mobile sidebars
	displaySelectedSuppProgram(selectedIds) {
		console.log("displaySelectedSuppProgram");
		var selectedSuppPro = document.getElementById("selected_supplimentary_program");
		var selectedSuppProMob = document.getElementById("selected_supplimentary_program_mob");
		selectedSuppPro.innerHTML = "";
		selectedSuppProMob.innerHTML = "";
		this.displaySelectedSuppPrograms(selectedIds, selectedSuppPro);
		this.displaySelectedSuppPrograms(selectedIds, selectedSuppProMob);
	}
	// Displays selected supplementary programs list in the specified container
	displaySelectedSuppPrograms(suppIds, selectedSuppPro) {
		console.log("displaySelectedSuppPrograms");
		var $this = this;
		// Filtering selected Supplementary program id from all Supplementary program data
		var selectedData = this.$suppPro.filter((item) =>
			suppIds.some((d) => d == item.programDetailId)
		);
		//Manipulating price text for with supplementary program and without
		var respricelabel = document.getElementById("res-price-label");
		var commpricelabel = document.getElementById("comm-price-label");
		if (selectedData.length == 0) {
			respricelabel.innerHTML = "Total Price";
			respricelabel.innerHTML = "Total Price";
			selectedSuppPro.classList.remove("added_supp_data");
			return false;
		} else {
			respricelabel.innerHTML = "Price";
			respricelabel.innerHTML = "Price";
			selectedSuppPro.classList.add("added_supp_data");
		}



		// Selected supplementary program list
		// Heading for supplementary program with icon
		let headContainer = creEl('div', 'horizontal-div supp-program')
		let head = creEl("p", "dm-sans bold-700");
		head.innerHTML = "Supplementary Program";
		headContainer.prepend(head);
		selectedSuppPro.appendChild(headContainer);

		// Supplementary program name and price list

		selectedData.forEach((sup) => {
			var suppProDiv = creEl('div', 'horizontal-div align-left');
			let suppleHeadingDiv = creEl('div', 'horizontal-div supplementary')

			let offeringType = creEl("div", "dm-sans offering-type");
			offeringType.innerHTML = sup.label;

			let offeringRemove = creEl("div", "dm-sans offering-remove");
			offeringRemove.innerHTML = "Remove";
			offeringRemove.addEventListener("click", function () {
				$this.removeSuppProgram(sup.programDetailId)
			})

			suppleHeadingDiv.prepend(offeringType, offeringRemove)

			let OfferingPrice = creEl("div", "dm-sans offering-price");
			OfferingPrice.innerHTML = "$" + parseFloat(sup.amount).toFixed(2);
			suppProDiv.prepend(suppleHeadingDiv, OfferingPrice);
			selectedSuppPro.appendChild(suppProDiv);
		});


	}
	// Removes a supplementary program from selection and updates UI
	removeSuppProgram(suppId) {
		console.log("removeSuppProgram");
		var suppProIdE = document.getElementById("suppProIds");
		var arrayIds = JSON.parse(suppProIdE.value);
		if (arrayIds.length > 0) {
			arrayIds.push(suppId);
			arrayIds = arrayIds.filter(i => i != suppId)
			suppProIdE.value = JSON.stringify(arrayIds);
			this.displaySelectedSuppProgram(arrayIds);
			const checkboxEl = document.querySelectorAll(".suppCheckbox");
			checkboxEl.forEach(checkbox => {
				let programDetailId = checkbox.getAttribute('programdetailid')
				if (programDetailId == suppId) {

					// Find the closest parent div
					const parentDiv = checkbox.closest('div').parentElement;
					if (checkbox.checked) {
						checkbox.checked = !checkbox.checked
						this.updateAmount(checkbox, checkbox.value);
						if(checkbox.closest('.you-might_slide-item')){
							checkbox.closest('.you-might_slide-item').classList.toggle('border-red')
						}	
					}

					// Find the corresponding "add-to-card" button inside the same parent div
					const addToCardButton = parentDiv.querySelector('.add-to-card');
					if (addToCardButton != undefined) {
						// Change the button's innerHTML based on the checkbox state
						addToCardButton.innerHTML = 'Add to Cart';
						addToCardButton.classList.remove('disabled');
						addToCardButton.style.pointerEvents = 'auto';
						addToCardButton.style.color = '';
						addToCardButton.style.backgroundColor = '#a51c30'
						addToCardButton.style.textDecoration = "none";
					}

				}

			})
		}
	}
	// Updates total price display including core product and supplementary programs
	updateOnlyTotalAmount() {
		console.log("updateOnlyTotalAmount");
		// Webflow total price dom element
		var totalPriceText = document.getElementById("totalPrice");
		// core product price for resdential, commuter and online
		var core_product_price = document.getElementById("core_product_price");
		// total amount price for supplementary program
		var totalAmountInput = document.getElementById("totalAmount");
		// manupulating total price based on selected supplementary program and core product price
		var amount =
			parseFloat(core_product_price.value.replace(/,/g, "")) + parseFloat(totalAmountInput.value);
		// added total price in dom element
		totalPriceText.innerHTML = this.numberWithCommas(amount.toFixed(2));

		// Webflow total price dom element
		var totalPriceTextMob = document.getElementById("totalPriceMobile");
		if (totalPriceTextMob) {
			// added total price in dom element
			totalPriceTextMob.innerHTML = this.numberWithCommas(amount.toFixed(2));
		}
	}
	// Updates total amount when supplementary program checkbox is toggled
	updateAmount(checkEvent, amount) {
		console.log("updateAmount");
		// Sum of supplementary program price
		var totalAmountInput = document.getElementById("totalAmount");
		// core product price for resdential, commuter and online
		var core_product_price = document.getElementById("core_product_price");
		// Webflow total price dom element
		var totalPriceText = document.getElementById("totalPrice");
		// Webflow total price dom element
		var totalPriceTextMob = document.getElementById("totalPriceMobile");
		// All added supplementary program id input fields
		var suppProIdE = document.getElementById("suppProIds");
		// selected supplementary program id
		var suppId = checkEvent.getAttribute("programDetailId");
		var selectedIds = [];
		if (checkEvent.checked) {
			// calulate total amount based on supplementary program price sum and core product price
			var amountHtml =
				parseFloat(core_product_price.value.replace(/,/g, "")) +
				parseFloat(totalAmountInput.value) +
				parseFloat(amount);
			totalPriceText.innerHTML = this.numberWithCommas(amountHtml.toFixed(2));
			if (totalPriceTextMob) {
				totalPriceTextMob.innerHTML = this.numberWithCommas(amountHtml.toFixed(2));
			}

			totalAmountInput.value = parseFloat(totalAmountInput.value) + parseFloat(amount);
			var arrayIds = JSON.parse(suppProIdE.value);
			arrayIds.push(suppId);
			//arrayIds = [...new Set(arrayIds)];
			selectedIds = arrayIds;
			suppProIdE.value = JSON.stringify(arrayIds);
		} else {
			// calulate total amount based on supplementary program price sum and core product price
			var amountHtml =
				parseFloat(core_product_price.value.replace(/,/g, "")) +
				parseFloat(totalAmountInput.value) -
				parseFloat(amount);
			totalPriceText.innerHTML = this.numberWithCommas(amountHtml.toFixed(2));
			if (totalPriceTextMob) {
				totalPriceTextMob.innerHTML = this.numberWithCommas(amountHtml.toFixed(2));
			}
			totalAmountInput.value = parseFloat(totalAmountInput.value) - parseFloat(amount);
			var arrayIds = JSON.parse(suppProIdE.value);
			//arrayIds = [...new Set(arrayIds)];
			var allSupIds = arrayIds.filter((i) => i != suppId);
			selectedIds = allSupIds;
			suppProIdE.value = JSON.stringify(allSupIds);
		}
		this.refreshTotalPriceVisibility(selectedIds);
		this.displaySelectedSuppProgram(selectedIds);
		//if(selectedIds.length > 0){
			this.updateCheckOutData({supplementaryProgramIds: selectedIds});
		//}
	}
	// Refreshes total price visibility based on selected supplementary programs and brief events
	refreshTotalPriceVisibility(selectedIds) {
		console.log("refreshTotalPriceVisibility");
		let suppIds = [];
		if (Array.isArray(selectedIds)) {
			suppIds = selectedIds;
		} else {
			try {
				const suppProIdE = document.getElementById("suppProIds");
				if (suppProIdE && suppProIdE.value) {
					const parsed = JSON.parse(suppProIdE.value);
					if (Array.isArray(parsed)) {
						suppIds = parsed;
					}
				}
			} catch (error) {
				suppIds = [];
			}
		}
		const shouldShow = suppIds.length > 0 || Boolean(this.appliedBriefEvent);
		this.toggleTotalPriceVisibility(shouldShow);
	}
	// Toggles visibility of total price divs based on whether items are selected
	toggleTotalPriceVisibility(shouldShow) {
		console.log("toggleTotalPriceVisibility");
		const totalPriceDiv = document.getElementById("totalPriceDiv");
		if (totalPriceDiv) {
			if (shouldShow) {
				totalPriceDiv.classList.add('show');
			} else {
				totalPriceDiv.classList.remove('show');
			}
		}
		const totalPriceDivMob = document.getElementById("totalPriceDivMob");
		if (totalPriceDivMob) {
			if (shouldShow) {
				totalPriceDivMob.classList.add('show');
			} else {
				totalPriceDivMob.classList.remove('show');
			}
		}
	}
	// Fetches data from the API endpoint
	async fetchData(endpoint) {
		console.log("fetchData");
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`);
			if (!response.ok) {
				throw new Error("Network response was not ok");
			}
			const data = await response.json();
			return data;
		} catch (error) {
			console.error("Error fetching data:", error);
			throw error;
		}
	}
	// Returns true when on online class checkout (has class offering cards). Use createCheckoutUrlForOnlineClass, NOT createCheckoutUrlsByProgram.
	isOnlineClassPage() {
		console.log("isOnlineClassPage");
		return !!(document.querySelector(".checkout_offering-grid-container") || document.querySelector("[data-class-offering-id]"));
	}
	// Creates Stripe checkout URLs for ACH, card, and pay later payment methods
	initializeStripePayment(paymentType = "", checkoutID = "", $baseUrl="createCheckoutUrlForOnlineClass") {
		console.log("initializeStripePayment");
		return new Promise((resolve, reject) => {
			if (this.isOnlineClassPage() && ($baseUrl === "createCheckoutUrlsByProgram" || $baseUrl === "updateStripeCheckoutDb")) {
				reject(new Error("Online class: use createCheckoutUrlForOnlineClass only"));
				return;
			}
			var suppProIdE = document.getElementById('suppProIds');
			var core_product_price = document.getElementById('core_product_price');

			//Payment button
			var ach_payment = document.getElementById('ach_payment');
			var card_payment = document.getElementById('card_payment');
			var paylater_payment = document.getElementById('paylater_payment');

			ach_payment.innerHTML = "Processing..."
			ach_payment.disabled = true;
			card_payment.innerHTML = "Processing..."
			card_payment.disabled = true;
			paylater_payment.innerHTML = "Processing..."
			paylater_payment.disabled = true;
			//var cancelUrl = new URL("https://www.nsdebatecamp.com"+window.location.pathname);
			var cancelUrl = new URL(window.location.href);
			if (!cancelUrl.searchParams.get('returnType')) {
				cancelUrl.searchParams.append('returnType', 'back')
			}
			
			var data = {
				"email": this.memberData.email.toLowerCase(),
				"label": this.memberData.programName,
				"programId": this.memberData.programId,
				"successUrl": this.memberData.site_url + "payment-confirmation?programId=" + this.memberData.programId,
				cancelUrl: cancelUrl.href.includes("file:///") ? "https://www.nsdebatecamp.com" : cancelUrl.href,
				"memberId": this.memberData.memberId,
				"programCategoryId": this.memberData.programCategoryId,
				"supplementaryProgramIds": JSON.parse(suppProIdE.value),
				"productType": this.memberData.productType,
				"programStartDate": this.getProgramFormattedDate(this.memberData.programStartDate),
				"programEndDate": this.getProgramFormattedDate(this.memberData.programEndDate),
				"achAmount": parseFloat(this.memberData.achAmount.replace(/,/g, '')),
				"cardAmount": parseFloat(this.memberData.cardAmount.replace(/,/g, '')),
				"payLaterAmount": parseFloat(this.memberData.payLaterAmount.replace(/,/g, '')),
				"device": (/Mobi|Android/i.test(navigator.userAgent)) ? 'Mobile' : 'Desktop',
				"deviceUserAgent": navigator.userAgent,
				"briefEventIds": this.getSelectedBriefEventIds()
			}
			if($baseUrl == "createCheckoutUrlsByProgram"){
				data.source = "cart_page"
			}
			// Added paymentId for supplementary program 
			if (this.memberData.productType == 'supplementary') {
				var supStuData = localStorage.getItem("supStuEmail");
				if (supStuData != null) {
					supStuData = JSON.parse(supStuData);
					if (supStuData.uniqueIdentification) {
						data.paymentId = supStuData.uniqueIdentification
					}
				}
			}
			if (checkoutID) {
				data.checkoutId = checkoutID
				data.paymentType = paymentType
			}
			//return true;
			var xhr = new XMLHttpRequest()
			var $this = this;
			xhr.open("POST", "https://8ri5d54llg.execute-api.us-west-1.amazonaws.com/test/camp/"+$baseUrl, true)
			xhr.withCredentials = false
			xhr.send(JSON.stringify(data))
			xhr.onload = function () {
				if(xhr.responseText == null){
					alert("Something went wrong. Please try again after some time.")
				}
				let responseText = JSON.parse(xhr.responseText);
				if (responseText.success) {

					$this.$checkoutData = responseText;

					//Storing data in local storage
					data.checkoutData = responseText

					var checkoutData = localStorage.getItem('checkOutData');
					if(checkoutData != null){
						data = {
							...JSON.parse(checkoutData),
							...data
						}
					}
					
					localStorage.setItem("checkOutData", JSON.stringify(data));

					ach_payment.innerHTML = "Checkout"
					ach_payment.disabled = false;
					card_payment.innerHTML = "Checkout"
					card_payment.disabled = false;
					paylater_payment.innerHTML = "Checkout"
					paylater_payment.disabled = false;
					$this.$checkOutResponse = true;
					resolve(responseText);
				} else {
					reject(new Error('API call failed'));
				}

			}
		});
	}
	/**
	 * For automation testing updating checkout url in hidden field
	 */
	// Adds checkout session IDs to hidden form fields for automation testing
	addSessionId() {
		console.log("addSessionId");
		var localCheckOutData = localStorage.getItem('checkOutData')
		if (localCheckOutData != undefined) {
			var localCheckOutData = JSON.parse(localCheckOutData);
			var achUrlSession = creEl("input", "achUrlSession", "achUrlSession");
			achUrlSession.type = "hidden";
			achUrlSession.value = localCheckOutData.checkoutData.achUrl;
			var cardUrlSession = creEl("input", "cardUrlSession", "cardUrlSession");
			cardUrlSession.type = "hidden";
			cardUrlSession.value = localCheckOutData.checkoutData.cardUrl;
			var payLaterSession = creEl("input", "payLaterUrlSession", "payLaterUrlSession");
			payLaterSession.type = "hidden";
			payLaterSession.value = localCheckOutData.checkoutData.payLaterUrl;
			var checkout_student_details = document.getElementById('checkout_student_details');
			checkout_student_details.appendChild(achUrlSession)
			checkout_student_details.appendChild(cardUrlSession)
			checkout_student_details.appendChild(payLaterSession)
		}
	}
	// Formats program date string to YYYY-MM-DD HH:MM:SS.MICROSECONDS format
	getProgramFormattedDate($date) {
		console.log("getProgramFormattedDate");
		if($date == undefined){
			return false;
		}	
		const inputDate = $date;
		const currentYear = new Date().getFullYear();

		// Create Date object
		const dateObj = new Date(`${inputDate}, ${currentYear}`);

		// Helper to add leading zeros
		const pad = (n, width = 2) => n.toString().padStart(width, '0');

		// Format to YYYY-MM-DD HH:MM:SS.MICROSECONDS
		const formattedDate = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}.000000`;
		return formattedDate;
	}
	// Updates student details in database and stores checkout data in localStorage
	updateStudentDetails(checkoutUrl) {
		console.log("updateStudentDetails");
		var $this = this;
		return new Promise((resolve, reject) => {
			var studentFirstName = document.getElementById('Student-First-Name');
			var studentLastName = document.getElementById('Student-Last-Name');
			var studentEmail = document.getElementById('Student-Email');
			var studentGrade = document.getElementById('Student-Grade');
			var studentSchool = document.getElementById('Student-School');
			var studentGender = document.getElementById('Student-Gender');
			var suppProIdE = document.getElementById('suppProIds');
			var core_product_price = document.getElementById('core_product_price');
			//Utm Source
			let localUtmSource = localStorage.getItem("utm_source");
			//Payment button
			var ach_payment = document.getElementById('ach_payment');
			var card_payment = document.getElementById('card_payment');
			var paylater_payment = document.getElementById('paylater_payment');
			ach_payment.innerHTML = "Processing..."
			ach_payment.disabled = true;
			card_payment.innerHTML = "Processing..."
			card_payment.disabled = true;
			paylater_payment.innerHTML = "Processing..."
			paylater_payment.disabled = true;
			//var cancelUrl = new URL("https://www.nsdebatecamp.com"+window.location.pathname);
			var cancelUrl = new URL(window.location.href);
			cancelUrl.searchParams.append('returnType', 'back')
			let studentEmailValue = studentEmail.value;
			let lowercaseStudentEmailValue = studentEmailValue.toLowerCase()
			var data = {
				"studentEmail": lowercaseStudentEmailValue,
				"firstName": studentFirstName.value,
				"lastName": studentLastName.value,
				"grade": studentGrade.value,
				"label": this.memberData.programName,
				"school": studentSchool.value,
				"gender": studentGender.value,
				"slug": this.memberData.slug,
				"createdOn": new Date().toISOString(),
				"programStartDate": this.getProgramFormattedDate(this.memberData.programStartDate),
				"programEndDate": this.getProgramFormattedDate(this.memberData.programEndDate),
				"memberId": this.memberData.memberId,
				"checkoutUrls": checkoutUrl,
				"utm_source": (localUtmSource != null) ? localUtmSource : "null"
			}
			var checkoutData = localStorage.getItem('checkOutData');
			var mergedData = {
				...JSON.parse(checkoutData),
				...data,
			}
			
			localStorage.setItem("checkOutData", JSON.stringify(mergedData));
			localStorage.setItem("isAbandonedModalOpen", false);
			var xhr = new XMLHttpRequest()
			
			xhr.open("POST", "https://3yf0irxn2c.execute-api.us-west-1.amazonaws.com/dev/camp/updateStripeCheckoutDb", true)
			xhr.withCredentials = false
			xhr.send(JSON.stringify(data))
			xhr.onload = function () {
				ach_payment.innerHTML = "Checkout"
				ach_payment.disabled = false;
				card_payment.innerHTML = "Checkout"
				card_payment.disabled = false;
				paylater_payment.innerHTML = "Checkout"
				paylater_payment.disabled = false;
				$this.addSessionId()
				resolve(true);
			}
		});
	}
	// Activates the specified checkout tab and syncs the stepper (content panel + breadcrumb stay in sync)
	activateDiv(divId) {
		console.log("activateDiv");
		var divIdToStepId = { checkout_program: 'program', checkout_student_details: 'student-details', checkout_payment: 'pay-deposite' };
		var divIds = ["checkout_program", "checkout_student_details", "checkout_payment"];
		divIds.forEach(function (id) {
			var el = document.getElementById(id);
			if (el) el.classList.remove("active_checkout_tab");
		});
		var targetEl = document.getElementById(divId);
		if (targetEl) targetEl.classList.add("active_checkout_tab");
		// Sync stepper: remove .active from ALL step lis, then add .active to the matching step (by id)
		var stepId = divIdToStepId[divId];
		var allStepLis = document.querySelectorAll('.stepper-container .stepper li, .stepper-container ul li, ul.stepper li, ul li.step');
		for (var i = 0; i < allStepLis.length; i++) {
			allStepLis[i].classList.remove('active');
		}
		var studentDetailsLi = document.getElementById('student-details');
		if (studentDetailsLi) studentDetailsLi.classList.remove('active');
		var activeStepEl = stepId ? document.getElementById(stepId) : null;
		if (!activeStepEl && stepId === 'pay-deposite') activeStepEl = document.getElementById('select-class-and-pay');
		if (activeStepEl) {
			activeStepEl.classList.add('active');
		} else if (stepId && allStepLis.length) {
			var stepOrder = ['create-account-new', 'student-details', 'pay-deposite', 'attend-camp'];
			var idx = stepOrder.indexOf(stepId);
			if (idx < 0) stepOrder = ['program', 'student-details', 'pay-deposite'];
			idx = stepOrder.indexOf(stepId);
			if (idx >= 0 && allStepLis[idx]) allStepLis[idx].classList.add('active');
		}
		if (divId === 'checkout_payment' && typeof this.updateOnlineClassPriceForTab === 'function' && this.isOnlineClassPage()) {
			var activeTab = document.querySelector('.checkout-tab-link.w--current') || document.querySelector('.checkout-tab-link');
			if (activeTab) {
				console.log("updateOnlineClassPriceForTab eventForPayNowBtn (payment step shown)");
				this.updateOnlineClassPriceForTab(activeTab);
			}
		}
	}
	// Sets up event handlers for next and previous navigation buttons in checkout flow
	addEventForPrevNaxt() {
		console.log("addEventForPrevNext");
		var initialCheckout = null
		var next_page_1 = document.getElementById("next_page_1");
		var next_page_2 = document.getElementById("next_page_2");
		var prev_page_1 = document.getElementById("prev_page_1");
		var prev_page_2 = document.getElementById("prev_page_2");
		var checkoutFormError = document.getElementById("checkout-form-error");
		var $this = this;
		var form = $("#checkout-form");
		if (next_page_1) {
			next_page_1.addEventListener("click", function () {
				$this.activateDiv("checkout_student_details");
				//initialCheckout = $this.initializeStripePayment();
			});
		}
		if (next_page_2) {
			console.log("next_page_2");
			next_page_2.addEventListener("click", function () {

			if (form.valid()) {
				// createCheckoutUrlsByProgram API not run here; run your API later (e.g. when user selects payment method or on payment step)
				// initialCheckout = $this.initializeStripePayment();
				if(!$this.$isAboundedProgram){
					$this.storeBasicData();
				}
				$this.updateOldStudentList();
				$this.displayStudentInfo("block");
				// validation for student email different form Parent email
				var isValidName = $this.checkUniqueStudentEmail();
				if (isValidName) {
					if (checkoutFormError) checkoutFormError.style.display = "none";
					$this.activateDiv("checkout_payment");
					// Checkout URLs and updateStudentDetails run when you call initializeStripePayment() later (e.g. from your API flow)
					if (initialCheckout) {
						initialCheckout.then(() => {
							var checkoutData = [$this.$checkoutData.achUrl, $this.$checkoutData.cardUrl, $this.$checkoutData.payLaterUrl];
							$this.updateStudentDetails(checkoutData).then(()=>{
								$this.$initCheckout = true;
							});
						})
					}
					$this.hideAndShowWhyFamilies('why-families-div', 'none')
					$this.hideAndShowByClass('rated-debate-banner', 'none')
					var sliderData = this.$suppPro = $this.$suppPro.filter(i => i.programDetailId != 21);
					if(sliderData.length > 0){
					      $this.hideShowDivById('checkout-supplimentary-data-2', 'block')
					      $this.hideShowDivById('checkout-supplimentary-data-desktop', 'block')
					}
					$this.initSlickSlider();
					$this.hideShowCartVideo('hide');
					$this.activeBreadCrumb('pay-deposite')
					const canShowBriefUpsell = Boolean($this.memberData && $this.memberData.isAdmin && !$this.$isAboundedProgram);
					if(canShowBriefUpsell){
						 // temp removed
						//$this.displayUpSellModal();
						// show briefs upsell modal
						$this.showBriefsUpsellModal();
					}{
						$this.$isAboundedProgram = false;
						$this.addToCart();
					}
					
				} else {
					if (checkoutFormError) checkoutFormError.style.display = "block";
				}
			}
		});
		}
		if (prev_page_1) {
			prev_page_1.addEventListener("click", function () {
				$this.activateDiv("checkout_program");
			});
		}
		if (prev_page_2) {
			console.log("prev_page_2");
			prev_page_2.addEventListener("click", function (e) {
				e.preventDefault();
				$this.reinitializePaymentTab();
				$this.activateDiv("checkout_student_details");
			});
		}

		let editStudentEl = document.querySelectorAll("[data-student-info='edit']")
		if (editStudentEl.length > 0) {
			editStudentEl.forEach(editBtn => {
				editBtn.addEventListener("click", function () {
					// click on edit button reinitialize payment tab
					$this.reinitializePaymentTab();
					$this.activateDiv("checkout_student_details");
				})
			})
		}
		
	}
	// Reinitializes payment tab by resetting UI state and hiding payment links
	reinitializePaymentTab(){
		console.log("reinitializePaymentTab");
		var bankTransferTab = document.getElementsByClassName("bank-transfer-tab")[0];
		if (bankTransferTab) bankTransferTab.click();
		var payNowLink = document.getElementById('pay-now-link');
		if (payNowLink && payNowLink.closest('div')) payNowLink.closest('div').style.display = "none";
		var payNowLink2 = document.getElementById('pay-now-link-2');
		if (payNowLink2 && payNowLink2.closest('div')) payNowLink2.closest('div').style.display = "none";
		var payNowLink3 = document.getElementById('pay-now-link-3');
		if (payNowLink3 && payNowLink3.closest('div')) payNowLink3.closest('div').style.display = "none";
		this.hideShowDivById('checkout-supplimentary-data-2', 'none');
		this.hideShowDivById('checkout-supplimentary-data-desktop', 'none');
		this.displayStudentInfo("none");
		this.hideAndShowWhyFamilies('why-families-div', 'block');
		this.hideShowCartVideo('show');
		this.activateDiv("checkout_student_details");
		this.activeBreadCrumb('student-details');
		setTimeout(function () {
			if (typeof $ !== "undefined" && $(".w-tab-link").length) {
				$(".w-tab-link").removeClass("w--current");
				$(".w-tab-pane").removeClass("w--tab-active");
				if (typeof Webflow !== "undefined" && Webflow.require) {
					try { Webflow.require("tabs").redraw(); } catch (err) {}
				}
			}
		}, 2000);
	}
	// validating duplicate email
	checkUniqueStudentEmail() {
		console.log("checkUniqueStudentEmail");
		var sENameE = document.getElementById("Student-Email");
		var sEmail = sENameE.value;
		sEmail = sEmail.replace(/\s/g, "");
		sEmail = sEmail.toLowerCase();
		var pEmail = this.memberData.email;
		pEmail = pEmail.replace(/\s/g, "");
		pEmail = pEmail.toLowerCase();
		if (sEmail == pEmail) {
			return false;
		} else {
			return true;
		}
	}
	// Sets up event handlers for payment method buttons (ACH, card, pay later)
	handlePaymentEvent() {
		console.log("handlePaymentEvent");
		var ach_payment = document.getElementById("ach_payment");
		var card_payment = document.getElementById("card_payment");
		var paylater_payment = document.getElementById("paylater_payment");
		var ibackbutton = document.getElementById("backbuttonstate");
		var $this = this;
		if (ach_payment) {
			ach_payment.addEventListener("click", function () {
				if (ibackbutton) ibackbutton.value = "1";
				if ($this.$initCheckout && $this.$checkoutData && $this.$checkoutData.achUrl) {
					window.location.href = $this.$checkoutData.achUrl;
					return;
				}
				if ($this.isOnlineClassPage()) {
					if (!$this.$selectedClassOfferingId) {
						alert("Please select a class offering first.");
						return;
					}
					ach_payment.innerHTML = "Processing...";
					ach_payment.disabled = true;
					$this.createCheckoutUrlForOnlineClass($this.$selectedClassOfferingId)
						.then(function (urls) {
							var goUrl = (urls && urls.achUrl) ? urls.achUrl : ($this.$checkoutData && $this.$checkoutData.achUrl) ? $this.$checkoutData.achUrl : null;
							if (goUrl) window.location.href = goUrl;
						})
						.catch(function (err) {
							ach_payment.innerHTML = "Checkout";
							ach_payment.disabled = false;
							alert("Something went wrong. Please try again.");
						});
					return;
				}
				var myInterval1 = setInterval(function () {
					if (!$this.$initCheckout) return;
					clearInterval(myInterval1);
					if ($this.$checkoutData && $this.$checkoutData.achUrl) {
						if (ibackbutton) ibackbutton.value = "1";
						window.location.href = $this.$checkoutData.achUrl;
						return;
					}
					var initialCheckout = $this.initializeStripePayment('us_bank_account', $this.$checkoutData && $this.$checkoutData.checkoutId, "updateStripeCheckoutDb");
					if (initialCheckout) {
						initialCheckout.then(function () {
							if (ibackbutton) ibackbutton.value = "1";
							window.location.href = $this.$checkoutData.achUrl;
						});
					}
				}, 1000);
			});
		}
		if (card_payment) {
			card_payment.addEventListener("click", function () {
				if (ibackbutton) ibackbutton.value = "1";
				if ($this.$initCheckout && $this.$checkoutData && $this.$checkoutData.cardUrl) {
					window.location.href = $this.$checkoutData.cardUrl;
					return;
				}
				if ($this.isOnlineClassPage()) {
					if (!$this.$selectedClassOfferingId) {
						alert("Please select a class offering first.");
						return;
					}
					card_payment.innerHTML = "Processing...";
					card_payment.disabled = true;
					$this.createCheckoutUrlForOnlineClass($this.$selectedClassOfferingId)
						.then(function (urls) {
							var goUrl = (urls && urls.cardUrl) ? urls.cardUrl : ($this.$checkoutData && $this.$checkoutData.cardUrl) ? $this.$checkoutData.cardUrl : null;
							if (goUrl) window.location.href = goUrl;
						})
						.catch(function (err) {
							card_payment.innerHTML = "Checkout";
							card_payment.disabled = false;
							alert("Something went wrong. Please try again.");
						});
					return;
				}
				var myInterval3 = setInterval(function () {
					if (!$this.$initCheckout) return;
					clearInterval(myInterval3);
					if ($this.$checkoutData && $this.$checkoutData.cardUrl) {
						if (ibackbutton) ibackbutton.value = "1";
						window.location.href = $this.$checkoutData.cardUrl;
						return;
					}
					var initialCheckout = $this.initializeStripePayment('card', $this.$checkoutData && $this.$checkoutData.checkoutId, "updateStripeCheckoutDb");
					if (initialCheckout) {
						initialCheckout.then(function () {
							if (ibackbutton) ibackbutton.value = "1";
							window.location.href = $this.$checkoutData.cardUrl;
						});
					}
				}, 1000);
			});
		}
		if (paylater_payment) {
			paylater_payment.addEventListener("click", function () {
				if (ibackbutton) ibackbutton.value = "1";
				if ($this.$initCheckout && $this.$checkoutData && $this.$checkoutData.payLaterUrl) {
					window.location.href = $this.$checkoutData.payLaterUrl;
					return;
				}
				if ($this.isOnlineClassPage() && (!$this.$checkoutData || !$this.$checkoutData.payLaterUrl)) {
					alert("Please select a class offering first.");
					return;
				}
				var myInterval5 = setInterval(function () {
					if (!$this.$initCheckout) return;
					clearInterval(myInterval5);
					if ($this.$checkoutData && $this.$checkoutData.payLaterUrl) {
						if (ibackbutton) ibackbutton.value = "1";
						window.location.href = $this.$checkoutData.payLaterUrl;
						return;
					}
					if ($this.isOnlineClassPage()) return;
					var initialCheckout = $this.initializeStripePayment('affirm', $this.$checkoutData && $this.$checkoutData.checkoutId, "updateStripeCheckoutDb");
					if (initialCheckout) {
						initialCheckout.then(function () {
							if (ibackbutton) ibackbutton.value = "1";
							window.location.href = $this.$checkoutData.payLaterUrl;
						});
					}
				}, 1000);
			});
		}
	}
	// Updates student form fields with data from localStorage for supplementary program purchase
	updateSuppData() {
		console.log("updateSuppData");
		var studentFirstName = document.getElementById("Student-First-Name");
		var studentLastName = document.getElementById("Student-Last-Name");
		var studentEmail = document.getElementById("Student-Email");
		var studentGrade = document.getElementById("Student-Grade");
		var studentSchool = document.getElementById("Student-School");
		var studentGender = document.getElementById("Student-Gender");
		var supStuData = localStorage.getItem("supStuEmail");
		if (supStuData != null) {
			supStuData = JSON.parse(supStuData);
			studentEmail.value = supStuData.studentEmail;
			studentEmail.readOnly = true;
			studentFirstName.value = supStuData.studentName.first;
			studentFirstName.readOnly = true;
			studentLastName.value = supStuData.studentName.last;
			studentLastName.readOnly = true;

			if (supStuData.studentGrade) {
				studentGrade.value = supStuData.studentGrade;
				studentGrade.disabled = true;
			}
			if (supStuData.school) {
				studentSchool.value = supStuData.school;
				studentSchool.readOnly = true;
			}
			if (supStuData.gender) {
				studentGender.value = supStuData.gender;
				studentGender.disabled = true;
			}
		    	var checkbox2 = document.getElementById("checkbox-2");
			if(!checkbox2.checked){
				checkbox2.checked = !checkbox2.checked
			    }
		}
	}
	// update default checkbox checked always
	updateDefaultCheckbox() {
		console.log("updateDefaultCheckbox");
		var dCheckbox = document.getElementById("checkbox");
		dCheckbox.setAttribute("disabled", true);
		// Update default price
		var cPrice = document.getElementsByClassName("pCorePrice");
		for (var i = 0; i < cPrice.length; i++) {
			let price = parseFloat(cPrice[i].innerHTML.replace(/,/g, "").replace(/\$/g, ""));
			cPrice[i].innerHTML = "$" + this.numberWithCommas(price.toFixed(2));
		}
	}
	isWithinAWeek(dateString) {
		console.log("isWithinAWeek");
		const date = new Date(dateString);
		const now = new Date();
		const oneWeekAgo = new Date();
		oneWeekAgo.setDate(now.getDate() - 7);
		return date >= oneWeekAgo && date <= now;
	}
	checkBackButtonEvent() {
		console.log("checkBackButtonEvent");
		var query = window.location.search;
		var urlPar = new URLSearchParams(query);
		var returnType = urlPar.get("returnType");
		var ibackbutton = document.getElementById('backbuttonstate');
		var checkoutJson = localStorage.getItem("checkOutData");
		if (checkoutJson != undefined) {
			var paymentData = JSON.parse(checkoutJson);
		}else{
			return;
		}
		if ((returnType == "back" || ibackbutton.value == 1 || this.isWithinAWeek(paymentData.createdOn)) && checkoutJson != undefined ) {
			return true;
		}else {
			return false;
		}
	}
	// Setup back stripe button and browser back button
	setUpBackButtonTab() {
		console.log("setUpBackButtonTab");
		var $this = this;
		var checkoutJson = localStorage.getItem("checkOutData");
		if (checkoutJson != undefined) {
			var paymentData = JSON.parse(checkoutJson);
		}else{
			return;
		}
		// check createdOn date for back button
		if(paymentData.createdOn == undefined){
			return;
		}

		if ( $this.checkBackButtonEvent() && checkoutJson != undefined) {
			var paymentData = JSON.parse(checkoutJson);
			this.$isAboundedProgram = true;
			//this.addSessionId()
			this.uncheckAllCardCheckbox();
			var studentFirstName = document.getElementById("Student-First-Name");
			var studentLastName = document.getElementById("Student-Last-Name");
			var studentEmail = document.getElementById("Student-Email");
			var studentGrade = document.getElementById("Student-Grade");
			var studentSchool = document.getElementById("Student-School");
			var studentGender = document.getElementById("Student-Gender");
			// Update all local storage data
			if(paymentData.studentEmail){
				studentEmail.value = paymentData.studentEmail;
			}
			if(paymentData.firstName){			
				studentFirstName.value = paymentData.firstName;
			}
			if(paymentData.lastName){
				studentLastName.value = paymentData.lastName;
			}

			if (paymentData.grade) {
				studentGrade.value = paymentData.grade;
			}

			if (paymentData.school) {
				studentSchool.value = paymentData.school;
			}

			if (paymentData.gender) {
				studentGender.value = paymentData.gender;
			}
			var checkbox2 = document.getElementById("checkbox-2");
			if(!checkbox2.checked){
		                checkbox2.checked = !checkbox2.checked
		            }

			if (paymentData.supplementaryProgramIds.length > 0) {
				var SuppCheckbox = document.getElementsByClassName("suppCheckbox");
				var uniqueProgramCategoryIds = new Set();
				for (let i = 0; i < SuppCheckbox.length; i++) {
					var checkBoxProgramdetailid = SuppCheckbox[i].getAttribute("programdetailid");
					
					if (!uniqueProgramCategoryIds.has(checkBoxProgramdetailid)) {
						uniqueProgramCategoryIds.add(checkBoxProgramdetailid);
						if (paymentData.supplementaryProgramIds.includes(checkBoxProgramdetailid)) {
							SuppCheckbox[i].checked = true
							$this.updateAmount(SuppCheckbox[i], SuppCheckbox[i].value);

							var elementSelector = ".supp_program_"+checkBoxProgramdetailid;;
							var matchedAddCartBtn = document.querySelectorAll(elementSelector)
							matchedAddCartBtn.forEach(add_to_card_btn => {
								add_to_card_btn.closest("div")
								add_to_card_btn.textContent = "Added";
								add_to_card_btn.style.pointerEvents = 'none'; // Disable pointer events
								add_to_card_btn.style.color = '#ffffff';
								add_to_card_btn.style.backgroundColor = "gray";
								//add_to_card_btn.style.textDecoration = "underline";
							})
							
						}
					}
				}
				if(paymentData.supplementaryProgramIds.length > 0){
					this.displaySelectedSuppProgram(paymentData.supplementaryProgramIds)
				}

				//update total amount for back button
				//this.updateOnlyTotalAmount()
				var totalPriceDiv = document.getElementById('totalPriceDiv');
				totalPriceDiv.style.visibility  = 'visible';
				//Updated supp id for back button
				// var suppProIdE = document.getElementById('suppProIds');
				// if(suppProIdE && paymentData.supplementaryProgramIds.length > 0){
				// 	suppProIdE.value = JSON.stringify(paymentData.supplementaryProgramIds)
				// }
			}
			if (paymentData) {
				this.$checkoutData = paymentData;
				var next_page_2 = document.getElementById("next_page_2");
				next_page_2.click()
				// this.addToCart()
				// this.activateDiv("checkout_payment");
				// this.displayStudentInfo("grid");
				// this.hideShowDivById('checkout-supplimentary-data-desktop', 'block')
				// this.hideAndShowWhyFamilies('why-families-div', 'none')
				// this.initSlickSlider();
			}
		} else {
			// removed local storage when checkout page rendar direct without back button
			//localStorage.removeItem("checkOutData");
		}
	}
	// Store student basic forms data
	storeBasicData() {
		console.log("storeBasicData");
		var studentFirstName = document.getElementById("Student-First-Name");
		var studentLastName = document.getElementById("Student-Last-Name");
		var studentEmail = document.getElementById("Student-Email");
		var studentGrade = document.getElementById("Student-Grade");
		var studentSchool = document.getElementById("Student-School");
		var studentGender = document.getElementById("Student-Gender");
		var suppProIdE = document.getElementById("suppProIds");
		//save data in local storage
		var data = {
			studentEmail: studentEmail.value,
			firstName: studentFirstName.value,
			lastName: studentLastName.value,
			grade: studentGrade.value,
			label: this.memberData.programName,
			school: studentSchool.value,
			gender: studentGender.value,
		};
		localStorage.setItem("checkOutBasicData", JSON.stringify(data));
	}
	// Update Basic data after reload
	updateBasicData() {
		console.log("updateBasicData");
		var checkoutJson = localStorage.getItem("checkOutBasicData");
		if (checkoutJson != undefined) {
			var paymentData = JSON.parse(checkoutJson);
			var studentFirstName = document.getElementById("Student-First-Name");
			var studentLastName = document.getElementById("Student-Last-Name");
			var studentEmail = document.getElementById("Student-Email");
			var studentGrade = document.getElementById("Student-Grade");
			var studentSchool = document.getElementById("Student-School");
			var studentGender = document.getElementById("Student-Gender");

			studentEmail.value = paymentData.studentEmail;

			studentFirstName.value = paymentData.firstName;

			studentLastName.value = paymentData.lastName;

			if (paymentData.grade) {
				studentGrade.value = paymentData.grade;
			}

			if (paymentData.school) {
				studentSchool.value = paymentData.school;
			}

			if (paymentData.gender) {
				studentGender.value = paymentData.gender;
			}
            		var checkbox2 = document.getElementById("checkbox-2");
			if(!checkbox2.checked){
		                checkbox2.checked = !checkbox2.checked
		            }
		}
	}
	// After API response we call the createMakeUpSession method to manipulate student data
	async renderPortalData(memberId) {
		console.log("renderPortalData");
		try {
			this.hidePayLaterTab();
			this.handlePaymentEvent();
			// Handle previous and next button
			this.addEventForPrevNaxt();
			// Sync content panel with stepper: if a step already has "active" (e.g. from HTML), activate the matching div
			var stepToDivId = { 'program': 'checkout_program', 'student-details': 'checkout_student_details', 'pay-deposite': 'checkout_payment' };
			var activeStep = document.querySelector('.stepper-container ul li.active')
				|| document.querySelector('ul li.step.active')
				|| document.querySelector('li.step.active');
			// Fallback: check each known step id; if it has .active, use it (in case container class differs)
			if (!activeStep) {
				for (var sid in stepToDivId) {
					var stepEl = document.getElementById(sid);
					if (stepEl && stepEl.classList.contains('active')) {
						activeStep = stepEl;
						break;
					}
				}
			}
			var stepId = activeStep && activeStep.id ? activeStep.id : null;
			if (stepId && stepToDivId[stepId]) {
				this.activateDiv(stepToDivId[stepId]);
			} else if (!this.checkBackButtonEvent()) {
				this.activateDiv("checkout_student_details");
			}
			// Delayed sync in case stepper gets "active" from Webflow/other script after DOM ready
			var $this = this;
			setTimeout(function syncStepperWithTab() {
				var active = document.querySelector('.stepper-container ul li.active')
					|| document.querySelector('ul li.step.active')
					|| document.querySelector('li.step.active');
				if (!active && stepToDivId) {
					for (var sid in stepToDivId) {
						var el = document.getElementById(sid);
						if (el && el.classList.contains('active')) { active = el; break; }
					}
				}
				var id = active && active.id ? active.id : null;
				if (id && stepToDivId[id]) $this.activateDiv(stepToDivId[id]);
			}, 150);
			// loader icon code
			var spinner = document.getElementById("half-circle-spinner");
			spinner.style.display = "block";

			// Setup back button for browser and stripe checkout page
			//this.setUpBackButtonTab();
			// Update basic data
			this.updateBasicData();
			// Update student data for purchase addon Supplementary program
			if (this.memberData.productType == "supplementary") {
				this.updateSuppData();
			}
			// Hide spinner
			spinner.style.display = "none";
			this.displaySupplementaryProgram();
			this.updateOldStudentList();
			try { this.eventForPayNowBtn(); } catch (e) { console.warn("eventForPayNowBtn:", e); }
		} catch (error) {
			console.error("Error rendering random number:", error);
		}
	}

	// Online class: on card click only store selected class_offering_id (API is called when payment method is selected in eventForPayNowBtn)
	setupClassOfferingCardClicks() {
		console.log("setupClassOfferingCardClicks");
		var $this = this;
		function handleClassOfferingClick(e) {
			var wrapper = e.target.closest(".checkout_offering-card-wrapper") || e.target.closest("[data-class-offering-id]");
			if (!wrapper) return;
			if (wrapper.classList.contains("full")) return;
			var classOfferingId = wrapper.getAttribute("data-class-offering-id");
			if (!classOfferingId) return;
			$this.$selectedClassOfferingId = classOfferingId;
			var container = wrapper.closest(".checkout_offering-grid-container");
			if (container) {
				container.querySelectorAll(".checkout_offering-card-wrapper, [data-class-offering-id]").forEach(function (el) { el.classList.remove("selected"); });
				wrapper.classList.add("selected");
			}
		}
		document.addEventListener("click", handleClassOfferingClick, true);
	}

	// Calls createCheckoutUrlForOnlineClass API; returns a Promise that resolves with { achUrl, cardUrl, payLaterUrl } for redirect.
	createCheckoutUrlForOnlineClass(classOfferingId) {
		console.log("createCheckoutUrlForOnlineClass");
		var apiUrl = "https://8ri5d54llg.execute-api.us-west-1.amazonaws.com/test/camp/createCheckoutUrlForOnlineClass";
		console.log("[Online class API] Calling:", apiUrl, "| class_offering_id:", classOfferingId, "| Check Network tab for this request.");
		var studentEmailEl = document.getElementById("Student-Email");
		var studentFirstNameEl = document.getElementById("Student-First-Name");
		var studentLastNameEl = document.getElementById("Student-Last-Name");
		var studentGradeEl = document.getElementById("Student-Grade");
		var studentGenderEl = document.getElementById("Student-Gender");
		var email = (this.memberData && this.memberData.email) ? this.memberData.email.toLowerCase().trim() : "";
		var memberId = (this.memberData && this.memberData.memberId) ? String(this.memberData.memberId).trim() : "";
		var studentEmail = studentEmailEl ? studentEmailEl.value.trim().toLowerCase() : "";
		var cancelUrl = new URL(window.location.href);
		cancelUrl.searchParams.set("returnType", "Back");
		var body = {
			email: email,
			memberId: memberId,
			class_offering_id: classOfferingId,
			student: {
				email: studentEmail,
				first_name: studentFirstNameEl ? studentFirstNameEl.value.trim() : "",
				last_name: studentLastNameEl ? studentLastNameEl.value.trim() : "",
				grade: studentGradeEl ? studentGradeEl.value.trim() : "",
				gender: studentGenderEl ? studentGenderEl.value.trim() : ""
			},
			successUrl: "https://www.nsdebatecamp.com/online-classes/payment-confirmation",
			cancelUrl: cancelUrl.href
		};
		var $this = this;
		return fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body)
		})
			.then(function (res) {
				if (!res.ok) {
					return res.json().catch(function () { return null; }).then(function (data) { throw new Error(data && data.message ? data.message : "API error"); });
				}
				return res.json();
			})
			.then(function (data) {
				if (!data) throw new Error("No response");
				var achUrl = data.achUrl || "";
				var cardUrl = data.cardUrl || "";
				var payLaterUrl = data.payLaterUrl || "";
				if (achUrl || cardUrl || payLaterUrl) {
					console.log("[Online class API] Success. Redirect URLs received (achUrl, cardUrl, payLaterUrl).");
					$this.$checkoutData = {
						achUrl: achUrl,
						cardUrl: cardUrl,
						payLaterUrl: payLaterUrl,
						checkoutId: data.checkoutId || null
					};
					$this.$initCheckout = true;
					$this.updateCheckoutUrlHiddenInputs(achUrl, cardUrl, payLaterUrl);
					var existing = localStorage.getItem("checkOutData");
					var merged = existing ? JSON.parse(existing) : {};
					merged.checkoutData = { achUrl: achUrl, cardUrl: cardUrl, payLaterUrl: payLaterUrl };
					localStorage.setItem("checkOutData", JSON.stringify(merged));
					return { achUrl: achUrl, cardUrl: cardUrl, payLaterUrl: payLaterUrl };
				}
				if (data.checkoutUrl || data.url) {
					window.location.href = data.checkoutUrl || data.url;
					return {};
				}
				throw new Error("No checkout URLs in response");
			})
			.catch(function (err) {
				console.error("[Online class API] Failed:", err.message || err);
				return Promise.reject(err);
			});
	}

	// Updates or creates hidden inputs (achUrlSession, cardUrlSession, payLaterUrlSession) used for payment redirects
	updateCheckoutUrlHiddenInputs(achUrl, cardUrl, payLaterUrl) {
		console.log("updateCheckoutUrlHiddenInputs");
		var ids = [
			{ id: "achUrlSession", value: achUrl || "" },
			{ id: "cardUrlSession", value: cardUrl || "" },
			{ id: "payLaterUrlSession", value: payLaterUrl || "" }
		];
		var container = document.getElementById("checkout_student_details") || document.getElementById("checkout_payment") || document.body;
		ids.forEach(function (item) {
			var el = document.getElementById(item.id);
			if (el) {
				el.value = item.value;
			} else {
				var input = creEl("input", null, item.id);
				input.type = "hidden";
				input.value = item.value;
				input.setAttribute("id", item.id);
				if (container) container.appendChild(input);
			}
		});
	}

	eventForPayNowBtn() {
		console.log("eventForPayNowBtn");
		const $this = this;
		function handlePayNowClick(e, payNowEl) {
			e.preventDefault();
			if ($this.isOnlineClassPage() && !$this.$selectedClassOfferingId) {
				alert("Please select a class offering first.");
				return;
			}
			if ($this.isOnlineClassPage() && $this.$selectedClassOfferingId) {
				payNowEl.style.pointerEvents = "none";
				payNowEl.innerHTML = "Processing...";
				var activeTab = document.querySelector('.checkout-tab-link.w--current');
				var isCard = !!(activeTab && activeTab.classList.contains('credit-card-tab'));
				console.log('[Online class] Calling checkout API for offering', $this.$selectedClassOfferingId, isCard ? '(card)' : '(ACH)');
				$this.createCheckoutUrlForOnlineClass($this.$selectedClassOfferingId)
					.then(function (urls) {
						var goUrl = isCard ? (urls && urls.cardUrl) || ($this.$checkoutData && $this.$checkoutData.cardUrl) : (urls && urls.achUrl) || ($this.$checkoutData && $this.$checkoutData.achUrl);
						if (goUrl) window.location.href = goUrl;
					})
					.catch(function (err) {
						payNowEl.style.pointerEvents = "";
						payNowEl.innerHTML = payNowEl.getAttribute("data-default-text") || "Checkout";
						alert("Something went wrong. Please try again.");
					});
				return;
			}
			payNowEl.style.pointerEvents = "none";
			payNowEl.innerHTML = "Processing..";
			var activePaymentLink = document.querySelector('.checkout_payment .w--tab-active a');
			if (activePaymentLink) activePaymentLink.click();
		}
		let payNowLink = document.getElementById('pay-now-link');
		if (payNowLink) {
			payNowLink.setAttribute("data-default-text", payNowLink.innerHTML || "Checkout");
			payNowLink.addEventListener("click", function (e) { handlePayNowClick(e, payNowLink); });
		}
		let payNowLinkMo = document.getElementById('pay-now-link-2');
		if (payNowLinkMo) {
			payNowLinkMo.setAttribute("data-default-text", payNowLinkMo.innerHTML || "Checkout");
			payNowLinkMo.addEventListener("click", function (e) { handlePayNowClick(e, payNowLinkMo); });
		}
		let payNowLink3 = document.getElementById('pay-now-link-3');
		if (payNowLink3) {
			payNowLink3.setAttribute("data-default-text", payNowLink3.innerHTML || "Checkout");
			payNowLink3.addEventListener("click", function (e) { handlePayNowClick(e, payNowLink3); });
		}

		var allTabs = document.getElementsByClassName("checkout-tab-link");
		for (var i = 0; i < allTabs.length; i++) {
			var tab = allTabs[i];
			if (!tab) continue;
			tab.addEventListener('click', function () {
				console.log("updateOnlineClassPriceForTab eventForPayNowBtn");
				$this.updateOnlineClassPriceForTab(this);
				if (payNowLink && payNowLink.closest('div')) payNowLink.closest('div').style.display = "block";
				if (payNowLinkMo && payNowLinkMo.closest('div')) payNowLinkMo.closest('div').style.display = "block";
				if (payNowLink3 && payNowLink3.closest('div')) payNowLink3.closest('div').style.display = "block";
				if (this.classList.contains('bank-transfer-tab')) {
					if (payNowLink) payNowLink.innerHTML = "Pay Now With Bank Transfer";
					if (payNowLinkMo) payNowLinkMo.innerHTML = "Pay Now With Bank Transfer";
					if (payNowLink3) payNowLink3.innerHTML = "Pay Now With Bank Transfer";
				} else if (this.classList.contains('credit-card-tab')) {
					if (payNowLink) payNowLink.innerHTML = "Pay Now With Credit Card";
					if (payNowLinkMo) payNowLinkMo.innerHTML = "Pay Now With Credit Card";
					if (payNowLink3) payNowLink3.innerHTML = "Pay Now With Credit Card";
				} else if (this.classList.contains('pay-later')) {
					if (payNowLink) payNowLink.innerHTML = "Pay Now With BNPL";
					if (payNowLinkMo) payNowLinkMo.innerHTML = "Pay Now With BNPL";
					if (payNowLink3) payNowLink3.innerHTML = "Pay Now With BNPL";
				}
				const hasBriefSelection = Boolean($this.appliedBriefEvent || $this.selectedBriefEvent);
				let hasSuppSelections = false;
				try {
					const suppProIdE = document.getElementById('suppProIds');
					if (suppProIdE && suppProIdE.value) {
						const parsed = JSON.parse(suppProIdE.value);
						hasSuppSelections = Array.isArray(parsed) && parsed.length > 0;
					}
				} catch (error) {
					hasSuppSelections = false;
				}
				if ((hasBriefSelection || hasSuppSelections) && typeof $this.updateOnlyTotalAmount === 'function') {
					requestAnimationFrame(() => {
						$this.updateOnlyTotalAmount();
					});
				}
			});
		}
		// Online class: set oc-price on load from active tab (in case user never clicks a tab)
		if ($this.isOnlineClassPage()) {
			var runPriceUpdate = function () {
				var activeTab = document.querySelector('.checkout-tab-link.w--current') || document.querySelector('.checkout-tab-link');
				if (activeTab) {
					console.log("updateOnlineClassPriceForTab eventForPayNowBtn (initial)");
					$this.updateOnlineClassPriceForTab(activeTab);
				}
			};
			runPriceUpdate();
			setTimeout(runPriceUpdate, 200);
			setTimeout(runPriceUpdate, 500);
		}
	}
	/**New Code for select old student */

	//updateOldStudentList
	async updateOldStudentList() {
		console.log("updateOldStudentList");
		const selectBox = document.getElementById('old-student');
		if (!selectBox) return;
		var $this = this;
		if (!this.memberData || this.memberData.memberId == null || this.memberData.memberId === '') {
			selectBox.innerHTML = '<option value="">Please sign in or refresh</option>';
			return;
		}
		try {
			const rawData = await this.fetchData("getAllPreviousStudents/" + this.memberData.memberId + "/true");
			// API may return array or { data: [] } / { students: [] }
			const data = Array.isArray(rawData) ? rawData : (rawData && (rawData.data || rawData.students)) || [];
			// Finding unique value and sorting by firstName (guard missing firstName/lastName)
			const filterData = data.filter((item, index, self) =>
				item && item.studentEmail && index === self.findIndex(obj => obj.studentEmail === item.studentEmail)
			).sort(function (a, b) {
				var aName = (a.firstName || '').trim();
				var bName = (b.firstName || '').trim();
				return aName.localeCompare(bName);
			});
			// Clear existing options
			selectBox.innerHTML = '';
			// Add a "Please select" option
			const defaultOption = document.createElement('option');
			defaultOption.value = '';
			defaultOption.textContent = 'Please select';
			selectBox.appendChild(defaultOption);
			// Add new options from the API data
			filterData.forEach((item, index) => {
				const option = document.createElement('option');
				option.value = index;
				option.textContent = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Student';
				selectBox.appendChild(option);
			});
			// Keep current list on instance so the single change listener always uses latest data
			$this.$oldStudentListData = filterData;
			// Only add change listener once to avoid duplicates when updateOldStudentList runs again
			if (!selectBox.dataset.oldStudentListener) {
				selectBox.dataset.oldStudentListener = 'true';
				selectBox.addEventListener('change', function (event) {
					var idx = event.target.value;
					var list = $this.$oldStudentListData;
					if (idx === '' || !list || !list[idx]) return;
					var chosen = list[idx];
					var data = {
						studentEmail: chosen.studentEmail,
						firstName: chosen.firstName,
						lastName: chosen.lastName,
						grade: chosen.studentGrade,
						school: chosen.school,
						gender: chosen.gender,
					};
					localStorage.setItem("checkOutBasicData", JSON.stringify(data));
					$this.updateBasicData();
				});
			}
		} catch (error) {
			console.error('Error fetching API data:', error);
			selectBox.innerHTML = '<option value="">Student Details not available</option>';
		}
	}
	displayUpSellModal() {
		console.log("displayUpSellModal");
		if (!this.memberData || !this.memberData.isAdmin) {
			return;
		}
		this.addToCart()
		if (this.memberData.hide_upsell) {
			return;
		}
		const modal = document.getElementById('upsell-modal-1');
		var $this = this;
		const noThanks = document.getElementsByClassName('no-thanks');
		let variant = this.getVariant();
		localStorage.setItem('_ab_test_variant', variant)
		if (modal) {
			//console.log('Showing modal on page load');
			this.showUpSellModal(modal);
		} else {
			//console.log('Modal element not found.');
		}
		if (noThanks) {
			for (let index = 0; index < noThanks.length; index++) {
				const element = noThanks[index];
				element.addEventListener('click', function () {
					$this.hideUpSellModal(modal)

				})

			}
		}
	}
	showUpSellModal(modal) {
		console.log("showUpSellModal");
		const check_up_sell = this.checkUpSellModalOpen();
		//console.log('check_up_sell', check_up_sell)
		if (check_up_sell) {
			return;
		}
		modal.classList.add('show');
		modal.style.display = 'flex';
		document.querySelector('.upsell-modal-bg').setAttribute('aria-hidden', 'false');
	}
	checkUpSellModalOpen() {
		console.log("checkUpSellModalOpen");
		let isOpen = false;
		const addToCartButtons = document.querySelectorAll(".add-to-card.upsell_add_to_card");
		addToCartButtons.forEach(button => {
			const parent = button.closest("div");
			if (parent) {
				const checkbox = parent.querySelector(".suppCheckbox");
				if (checkbox.checked) {
					isOpen = checkbox.checked
				}
			}
		})
		return isOpen;
	}
	uncheckAllCardCheckbox() {
		console.log("uncheckAllCardCheckbox");
		//setTimeout(() => {
			const addToCartButtons = document.querySelectorAll(".add-to-card");
			addToCartButtons.forEach(button => {
				const parent = button.closest("div");
				if (parent) {
					const checkbox = parent.querySelector(".suppCheckbox");
					if (checkbox) {
					checkbox.checked = false;
					//console.log("checkbox.checked", checkbox.checked)
					}
				}
			})
		//}, 100);
	}
	hideUpSellModal(modal) {
		console.log("hideUpSellModal");
		modal.classList.remove('show');
		modal.style.display = 'none';
		document.querySelector('.upsell-modal-bg').removeAttribute('aria-hidden');
	}
	addToCart() {
		console.log("addToCart");
		// Select all 'add-to-card' buttons
		const addToCartButtons = document.querySelectorAll(".add-to-card");
		var $this = this;
		addToCartButtons.forEach(button => {
			button.addEventListener("click", function (event) {
				event.preventDefault(); // Prevent default link behavior

				// Find the parent container with the 'btn-reserve-spot' class
				const parent = button.closest("div");

				if (parent) {
					// Locate the child checkbox within the parent container
					const checkbox = parent.querySelector(".suppCheckbox");

					if (checkbox && !checkbox.checked) {
						// Toggle the checkbox state
						checkbox.checked = !checkbox.checked;
						//if(checkbox.checked){
						$this.updateAmount(checkbox, checkbox.value);
						//}

						// Update the button text based on the checkbox state
						button.textContent = checkbox.checked ? "Added" : "Add to Cart";
						if(checkbox.checked){
							button.style.pointerEvents = 'none'; // Disable pointer events
							button.style.color = '#ffffff';
							button.style.backgroundColor = "gray";
							//button.style.textDecoration = "underline";
						}
						// Optional: Add or remove a disabled class (if needed)
						button.classList.toggle("disabled", checkbox.checked);
						// Add red border in slider 
						if(button.closest('.you-might_slide-item')){
							button.closest('.you-might_slide-item').classList.toggle('border-red')
						}
						// update added text for same program in another section
						var programDetailId = checkbox.getAttribute('programdetailid');
						var elementSelector = ".supp_program_"+programDetailId;;
						var matchedAddCartBtn = document.querySelectorAll(elementSelector)
						matchedAddCartBtn.forEach(add_to_card_btn => {
							add_to_card_btn.closest("div")
							add_to_card_btn.textContent = "Added";
							add_to_card_btn.style.pointerEvents = 'none'; // Disable pointer events
							add_to_card_btn.style.color = '#ffffff';
							add_to_card_btn.style.backgroundColor = "gray";
							//add_to_card_btn.style.textDecoration = "underline";
						})
						//while ($this.$suppPro.length == 0) {
							//console.log("$this.$suppPro.length", $this.$suppPro.length)
						//}
						setTimeout(() => {
							const modal = document.getElementById('upsell-modal-1');
							$this.hideUpSellModal(modal)
						}, 100);

					}

				}
				//_care_package_add_to_card
				if (this.classList.contains('care_package_add_to_card')) {
					const _care_package_add_to_card = document.querySelectorAll(".care_package_add_to_card");
					_care_package_add_to_card.forEach(add_to_card_btn => {
						add_to_card_btn.textContent = "Added";
						add_to_card_btn.style.pointerEvents = 'none'; // Disable pointer events
						add_to_card_btn.style.color = '#ffffff';
						add_to_card_btn.style.backgroundColor = "gray";
						//add_to_card_btn.style.textDecoration = "underline";
					})
				}
			});
		});
	}
	async displaySupplementaryProgram() {
		console.log("displaySupplementaryProgram");
		let container2 = document.getElementById("checkout-supplimentary-data-2");
		let swiperSlideWrapper = container2.querySelector('.you-might_slick-slider')

		
		// New Slider with add-to-cart and learn more button
		let container3 = document.getElementById("checkout-supplimentary-data-desktop");
		let newSlideWrapper = container3.querySelector('.you-might-slider-container')

		// For Mobile Slider
		let container4 = document.getElementById("checkout-supplimentary-data-mobile");
		let mobileSlideWrapper = container4.querySelector('.you-might-slider-container-mobile')

		if (this.$suppPro.length > 0) return;
		// getSupplementaryProgram API call removed; use empty data so supplementary UI still runs
		let apiData = [];

		// sorting data by programDetailId
		apiData.sort((a, b) => b.programDetailId - a.programDetailId);
		
		// Added in our Local Data
		this.$suppPro = apiData;
		let prep_week_searchText = "topic prep week";
		let tutoring_week_searchText = "5 hours";
		//let variant_type = _vwo_exp[_vwo_exp_ids[0]].combination_chosen;
		let variant_type = this.getVariant();
		variant_type = variant_type != undefined || variant_type != null ? variant_type : "";
		let prep_week_data = apiData.filter(i => i.label.toLowerCase().includes(prep_week_searchText.toLowerCase()))
		let tutoring_data = apiData.filter(i => i.label.toLowerCase().includes(tutoring_week_searchText.toLowerCase()))
		let care_package_data = apiData.find(i => i.programDetailId == 21);
		this.updateUpSellModal(prep_week_data, tutoring_data, care_package_data)
		
		if(!this.memberData.hide_upsell ){
			if (variant_type == 1) {
				apiData = apiData.filter(i => !i.label.toLowerCase().includes(prep_week_searchText.toLowerCase()));
			} else {
				apiData = apiData.filter(i => !i.label.toLowerCase().includes(tutoring_week_searchText.toLowerCase()));
			}
		}
		apiData = apiData.filter(i => i.programDetailId != 21);

		if(!apiData.length){
			swiperSlideWrapper.style.display="none";
			// New Slider hide if no API data
			newSlideWrapper.style.display = "none";

			mobileSlideWrapper.style.display = "none";
			
		}
		
		if (container2 == undefined) return;

		if(container3 == undefined) return;
		if(container4 == undefined) return;
		
		if (swiperSlideWrapper == undefined) return

		if (newSlideWrapper == undefined) return

		if (mobileSlideWrapper == undefined) return

		// Modal Content Update
		

		swiperSlideWrapper.innerHTML = "";
		newSlideWrapper.innerHTML = "";
		mobileSlideWrapper.innerHTML = "";

		// Modal Content Update
		let modalContent = document.querySelector(
			".supp-programs-description-wrapper"
		  );
	  
		if (!apiData.length) {
		modalContent.style.display = "none";
		}
	
		if (modalContent == undefined) return;
	
		modalContent.innerHTML = "";


		apiData.forEach(item => {
			item.forumType = "Public Forum";
			//slider div
			let swiperSlide = creEl('div', 'you-might_slide-item')
			const outerShadowDiv1 = this.displaySingleSuppProgram(item, 'desktop', swiperSlide);
			swiperSlide.appendChild(outerShadowDiv1)
			swiperSlideWrapper.prepend(swiperSlide)

			//newSlider div
			let newSliderSlide = creEl('div', 'you-might_slide-item')
			const newOuterShadowDiv1 = this.newDisplaySingleSuppProgram(item, 'desktop', newSliderSlide);
			newSliderSlide.appendChild(newOuterShadowDiv1)
			newSlideWrapper.prepend(newSliderSlide)

			//Mobile slider div
			let mobileSliderSlide = creEl('div', 'you-might_slide-item')
			const mobileOuterShadowDiv1 = this.newDisplaySingleSuppProgram(item, 'desktop', mobileSliderSlide);
			mobileSliderSlide.appendChild(mobileOuterShadowDiv1)
			mobileSlideWrapper.prepend(mobileSliderSlide)

			// Modal Content Update
			const modalSingleContent = this.displayModalSuppProgram(item, "modal");
			modalContent.prepend(modalSingleContent);

		});
		this.closeIconEvent();
		// Setup back button for browser and stripe checkout page
		this.setUpBackButtonTab();
		if(apiData.length == 0){
			container2.style.display = "none";
			container3.style.display = "none";
			container4.style.display = "none";
			return;
		}
	}
	initSlickSlider() {
		console.log("initSlickSlider");
		var $slider = $('.you-might_slick-slider');
		
		if ($slider.hasClass('slick-initialized')) {
			$slider.slick('destroy');
			$slider.slick('unslick'); // Destroy slick instance
		}
		var slickSettings = {
			speed: 300,
			slidesToShow: 1,
			slidesToScroll: 1,
			infinite: false,
			centerMode: false,
			variableWidth: false,
			arrows: false,
			dots: true,
			adaptiveHeight: true
		};
		// Check if the slider is already initialized
		if (!$slider.hasClass('slick-initialized')) {
			// Initialize you might slider
			var $sliderYouMight = $slider.slick(slickSettings);

			// Shared navigation logic for the "You Might" slider
			$('.left-arrow-slick').click(function () {
				//console.log("You Might: Left arrow clicked.");
				$sliderYouMight.slick('slickPrev');
			});

			$('.right-arrow-slick').click(function () {
				//console.log("You Might: Right arrow clicked.");
				$sliderYouMight.slick('slickNext');
			});
		}
		// New Slider
		var $slider2 = $('.you-might-slider-container');
		
		if ($slider2.hasClass('slick-initialized')) {
			$slider2.slick('destroy');
			$slider2.slick('unslick'); // Destroy slick instance
		}
		// Check if the slider is already initialized
		if (!$slider2.hasClass('slick-initialized')) {
			// Initialize you might slider
			var $sliderYouMightNew = $slider2.slick(slickSettings);

			$('.you-might-left-arrow').click(function () {
				//console.log("You Might: Left arrow clicked.");
				$sliderYouMightNew.slick('slickPrev');
			});
	 
			$('.you-might-right-arrow').click(function () {
				//console.log("You Might: Right arrow clicked.");
				$sliderYouMightNew.slick('slickNext');
			});
		}

		// Mobile Slider
		var $slider3 = $('.you-might-slider-container-mobile');
		
		if ($slider3.hasClass('slick-initialized')) {
			$slider3.slick('destroy');
			$slider3.slick('unslick'); // Destroy slick instance
		}
		// Check if the slider is already initialized
		if (!$slider3.hasClass('slick-initialized')) {
			// Initialize you might slider
			var $sliderYouMightMobile = $slider3.slick(slickSettings);

			$('.you-might-left-arrow').click(function () {
				//console.log("You Might: Left arrow clicked.");
				$sliderYouMightMobile.slick('slickPrev');
			});
	 
			$('.you-might-right-arrow').click(function () {
				//console.log("You Might: Right arrow clicked.");
				$sliderYouMightMobile.slick('slickNext');
			});
		}

	}
	updateUpSellModal(prep_week_data, tutoring_data, care_package_data) {
		console.log("updateUpSellModal");

		if (prep_week_data.length > 0) {
			var tpwAmount = document.getElementById('tpw-amount');
			if (tpwAmount != undefined) {
				tpwAmount.innerHTML = "$" + parseFloat(prep_week_data[0].amount).toFixed(2);
			}
			var tpwSaveAmount = document.getElementById('tpw-save-amount');
			if (tpwSaveAmount != undefined) {
				tpwSaveAmount.innerHTML = "$" + parseFloat(prep_week_data[0].disc_amount - prep_week_data[0].amount).toFixed(2)
			}
			var tpwDescAmount = document.getElementById('tpw-desc-amount');
			if (tpwDescAmount != undefined) {
				tpwDescAmount.innerHTML = "$" + parseFloat(prep_week_data[0].disc_amount).toFixed(2)
			}
			var upsellTpwProgranId = document.getElementById('upsellTpwProgranId');
			if (upsellTpwProgranId != undefined) {
				upsellTpwProgranId.setAttribute('programdetailid', prep_week_data[0].programDetailId)
				upsellTpwProgranId.value = prep_week_data[0].amount
			}
			// For mobile upsellTpwProgranId-1
			var upsellTpwProgranIdMob = document.getElementById('upsellTpwProgranId-1');
			if (upsellTpwProgranIdMob != undefined) {
				upsellTpwProgranIdMob.setAttribute('programdetailid', prep_week_data[0].programDetailId)
				upsellTpwProgranIdMob.value = prep_week_data[0].amount
			}


			let tpwTitle = document.querySelector("[upsell-modal='tpw-title']")
			if (tpwTitle != undefined) {
				tpwTitle.innerHTML = prep_week_data[0].label
			}
			let tpwReadMore = document.querySelectorAll("[upsell-modal='tpw_read-more']")
			if (tpwReadMore.length > 0) {
				tpwReadMore.forEach(read_more_link => {
					read_more_link.href = this.memberData.site_url + "topic-prep-week";
				})
			}

		}


		if (tutoring_data.length > 0) {
			var tutoAmount = document.getElementById('tuto-amount');
			if (tutoAmount != undefined) {
				tutoAmount.innerHTML = "$" + parseFloat(tutoring_data[0].amount).toFixed(2);
			}
			var tutoSaveAmount = document.getElementById('tuto-save-amount');
			if (tutoSaveAmount != undefined) {
				tutoSaveAmount.innerHTML = "$" + parseFloat(tutoring_data[0].disc_amount - tutoring_data[0].amount).toFixed(2)
			}
			var tutoDescAmount = document.getElementById('tuto-desc-amount');
			if (tutoDescAmount != undefined) {
				tutoDescAmount.innerHTML = "$" + parseFloat(tutoring_data[0].disc_amount).toFixed(2)
			}
			var upsellTutoProgranId = document.getElementById('upsellTutoProgranId');
			if (upsellTutoProgranId != undefined) {
				upsellTutoProgranId.setAttribute('programdetailid', tutoring_data[0].programDetailId)
				upsellTutoProgranId.value = tutoring_data[0].amount
			}
			// Mobile div id upsellTutoProgranId-1
			var upsellTutoProgranIdMob = document.getElementById('upsellTutoProgranId-1');
			if (upsellTutoProgranIdMob != undefined) {
				upsellTutoProgranIdMob.setAttribute('programdetailid', tutoring_data[0].programDetailId)
				upsellTutoProgranIdMob.value = tutoring_data[0].amount
			}

			//tutoring title
			let tutoringTitle = document.querySelector("[upsell-modal='tutoring-title']")
			if (tutoringTitle != undefined) {
				tutoringTitle.innerHTML = tutoring_data[0].label
			}

			let tutoringReadMore = document.querySelectorAll("[upsell-modal='tutoring_read-more']")
			if (tutoringReadMore.length > 0) {
				tutoringReadMore.forEach(read_more_link => {
					read_more_link.href = this.memberData.site_url + "debate-tutoring";
				})
			}
		}
		// Care Package Data Update
		if(care_package_data != undefined){
			let carePackagePrice = document.querySelectorAll("[data-care-package='price']")
			if (carePackagePrice.length > 0) {
				carePackagePrice.forEach(cp_price => {
					cp_price.innerHTML = "$"+care_package_data.amount;
				})
			}
			let carePackageCheckbox = document.querySelectorAll("[data-care-package='checkbox']")
			if (carePackageCheckbox.length > 0) {
				carePackageCheckbox.forEach(cp_checkbox => {
					cp_checkbox.setAttribute('programdetailid', care_package_data.programDetailId)
					cp_checkbox.value = care_package_data.amount
				})
			}
		}
	}
	// New UpSell Program / Supplementary
	displaySingleSuppProgram(item, size, slideDiv) {
		console.log("displaySingleSuppProgram");
		var $this = this;
		// Create the outer-shadow div
		//const outerDiv = document.createElement("div");
		//outerDiv.classList.add("div-block-93", "outer-shadow");
		// Create the grid container
		const gridDiv = document.createElement("div");
		gridDiv.classList.add("w-layout-grid", "payment-conf-program-grid", "upsell");

		// Create the course-info div (left column)
		const courseInfoDiv = document.createElement("div");

		const upsellDiv = document.createElement("div");
		upsellDiv.classList.add("upsell-div");

		// Create the checkbox
		const checkboxDiv = document.createElement("div");
		checkboxDiv.classList.add("core-checkbox");

		const label = document.createElement("label");
		label.classList.add("w-checkbox");

		const input = document.createElement("input");
		input.classList.add("w-checkbox-input", "core-checkbox", "suppCheckbox");
		input.type = "checkbox";
		input.id = size + item.label.replace(/\s+/g, '-').toLowerCase();
		input.name = "checkbox";
		input.value = item.amount;
		input.setAttribute("programdetailid", item.programDetailId);
		input.setAttribute("data-name", "Checkbox");
		var $this = this;
		input.addEventListener("change", function () {
			this.checked ? slideDiv.classList.add('border-red') : slideDiv.classList.remove('border-red')
			$this.updateAmount(this, item.amount);
		})

		const span = document.createElement("span");
		span.classList.add("core-checkbox-label", "w-form-label");

		label.appendChild(input);
		label.appendChild(span);
		checkboxDiv.appendChild(label);
		const labelWrapper = creEl('div')
		const campNameDiv = document.createElement("label");
		campNameDiv.classList.add("camp-name", "margin-bottom-0");
		campNameDiv.setAttribute("for", size + item.label.replace(/\s+/g, '-').toLowerCase())
		campNameDiv.textContent = item.label;
		labelWrapper.appendChild(campNameDiv)
		courseInfoDiv.appendChild(labelWrapper)
		//upsellDiv.appendChild(checkboxDiv);
		///upsellDiv.appendChild(campNameDiv);


		const textBlockWrapper = document.createElement("div");
		textBlockWrapper.classList.add("text-block-wrapper");

		item.tags.forEach(tag => {
			const tagDiv = document.createElement("div");
			tagDiv.classList.add("payment-conf-tag", "bg-color-light-blue");
			tagDiv.style.backgroundColor = tag.color
			tagDiv.textContent = tag.name;
			textBlockWrapper.appendChild(tagDiv);
		});

		const priceItem = document.createElement("div");
		priceItem.classList.add("price-item");

		const saveDiv1 = document.createElement("div");
		saveDiv1.classList.add("save-amount");
		saveDiv1.textContent = "Save";

		const saveDiv2 = document.createElement("div");
		saveDiv2.classList.add("save-amount");
		saveDiv2.textContent = "$" + (parseFloat(item.disc_amount) - parseFloat(item.amount)).toFixed(2);

		priceItem.appendChild(saveDiv1);
		priceItem.appendChild(saveDiv2);
		
		slideDiv.appendChild(upsellDiv);
		upsellDiv.appendChild(textBlockWrapper);

		

		// Create the price details div (right column)
		const priceDiv = document.createElement("div");
		priceDiv.classList.add("course-info", "p-16", "upsell");

		const discountPriceDiv = document.createElement("div");
		const discountLabel = document.createElement("div");
		discountLabel.classList.add("dm-sans", "bold-700");
		discountLabel.textContent = "Discount Price";
		discountPriceDiv.appendChild(discountLabel);

		const priceWrapper1 = document.createElement("div");
		priceWrapper1.classList.add("price-wrapper", "upsell");

		const originalPriceDiv1 = document.createElement("div");
		originalPriceDiv1.classList.add("price-item", "upsell");

		const originalPrice = document.createElement("div");
		originalPrice.classList.add("original-price");
		originalPrice.textContent = "$" + item.disc_amount;
		originalPriceDiv1.appendChild(originalPrice);

		const discountedPriceDiv = document.createElement("div");
		discountedPriceDiv.classList.add("price-item", "upsell");

		const discountedPrice = document.createElement("div");
		discountedPrice.classList.add("discounted-price", "text-blue");
		discountedPrice.textContent = "$" + item.amount;
		discountedPriceDiv.appendChild(discountedPrice);

		priceWrapper1.appendChild(priceItem);
		priceWrapper1.appendChild(originalPriceDiv1);
		priceWrapper1.appendChild(discountedPriceDiv);

		

		priceDiv.appendChild(discountPriceDiv);
		courseInfoDiv.appendChild(priceWrapper1);
		

		gridDiv.appendChild(courseInfoDiv);
		gridDiv.appendChild(checkboxDiv)
		//gridDiv.appendChild(priceDiv);

		//outerDiv.appendChild(gridDiv);

		return gridDiv;
	}
	getVariant() {
		console.log("getVariant");
		let variant = 1;
		//let topicPripUpSellModal = document.querySelector('.topic-prep_modal-container')
		let tutoringUpSellModal = document.querySelector('.upsell-modal-container.tutoring')
		if (window.getComputedStyle(tutoringUpSellModal).display != 'none') {
			variant = 2;
		}
		return variant
	}
	hideShowCartVideo(visibility) {
		console.log("hideShowCartVideo");
		let videoEl = document.querySelector('.cart-sidebar .w-embed-youtubevideo');
		if (visibility == "show") {
			videoEl.style.display = "block"
		} else {
			videoEl.style.display = "none"
		}
	}
	hideShowDivById(Id, display) {
		console.log("hideShowDivById");
		if (Id) {
			document.getElementById(Id).style.display = display
		}
	}
	hideAndShowWhyFamilies(classs, display) {
		console.log("hideAndShowWhyFamilies");
		if (classs) {
			document.querySelector('.' + classs).style.display = display
		}
			// Shared Slick slider settings
			var $slider =  $('.why-families_slick-slider');
			
			if ($slider.hasClass('slick-initialized')) {
				$slider.slick('destroy');
				$slider.slick('unslick'); // Destroy slick instance
			}
			var slickSettings = {
				speed: 300,
				slidesToShow: 1,
				slidesToScroll: 1,
				infinite: false,
				centerMode: false,
				variableWidth: false,
				arrows: false,
				dots: true,
			};
            if (!$slider.hasClass('slick-initialized')) {
                // Initialize both sliders
                var $sliderFamilies = $slider.slick(slickSettings);
            
                // Shared navigation logic for the "Why Families" slider
                $('.families-left-arrow').click(function () {
                    //console.log("Why Families: Left arrow clicked.");
                    $sliderFamilies.slick('slickPrev');
                });
        
                $('.families-right-arrow').click(function () {
                    //console.log("Why Families: Right arrow clicked.");
                    $sliderFamilies.slick('slickNext');
                });
            }
	}
	hideAndShowByClass(classs, display) {
		console.log("hideAndShowByClass");
		if (classs) {
			document.querySelector('.' + classs).style.display = display
		}
	}
	activeBreadCrumb(activeId) {
		console.log("activeBreadCrumb");
		var activeEl = document.getElementById(activeId);
		if (!activeEl && activeId === 'pay-deposite') activeEl = document.getElementById('select-class-and-pay');
		var breadCrumbList = document.querySelectorAll('.stepper-container .stepper li, .stepper-container ul li, ul.stepper li, ul li.step');
		for (var b = 0; b < breadCrumbList.length; b++) {
			breadCrumbList[b].classList.remove('active');
		}
		if (activeEl) {
			activeEl.classList.add('active');
		} else if (breadCrumbList.length) {
			var stepOrder = ['create-account-new', 'student-details', 'pay-deposite', 'attend-camp'];
			var idx = stepOrder.indexOf(activeId);
			if (idx < 0) stepOrder = ['program', 'student-details', 'pay-deposite'];
			idx = stepOrder.indexOf(activeId);
			if (idx >= 0 && breadCrumbList[idx]) breadCrumbList[idx].classList.add('active');
		}
		var stepToDivId = {
			'program': 'checkout_program',
			'student-details': 'checkout_student_details',
			'pay-deposite': 'checkout_payment'
		};
		if (stepToDivId[activeId]) {
			this.activateDiv(stepToDivId[activeId]);
		}
	}

	// New Supplimentary program update

	showModal(display){
		console.log("showModal");
		const suppProgramsModal = document.getElementById('suppProgramsModal');
		suppProgramsModal.classList.add('show');
		suppProgramsModal.style.display = 'flex';
	}
	hideModal(){
		console.log("hideModal");
		const suppProgramsModal = document.getElementById('suppProgramsModal');
		suppProgramsModal.classList.add('show');
		suppProgramsModal.style.display = 'flex';
	}
	closeIconEvent() {
		console.log("closeIconEvent");
		const closeLinks = document.querySelectorAll(
		  ".upsell-close-link, .main-button.close"
		);
		closeLinks.forEach(function (closeLink) {
		  closeLink.addEventListener("click", function (event) {
			event.preventDefault();
			event.stopPropagation(); // Prevent event bubbling
	
			// First, try getting the modal from `data-target`
			const targetModalId = closeLink.getAttribute("data-target");
			let targetModal = targetModalId
			  ? document.getElementById(targetModalId)
			  : null;
	
			// If no `data-target`, find the closest parent that is a modal (checking if it has inline `display: flex;`)
			if (!targetModal) {
			  targetModal = closeLink.closest('[role="dialog"][aria-modal="true"]');
			}
	
			if (targetModal) {
			  //console.log(`Closing ${targetModal.id}`);
			  targetModal.classList.remove("show");
			  targetModal.style.display = "none";
			}
		  });
		});
	  }
	// New UpSell Program / Supplementary
	newDisplaySingleSuppProgram(item, size, slideDiv) {
		console.log("newDisplaySingleSuppProgram");
		// Create main grid container
		const gridDiv = document.createElement("div");
		gridDiv.classList.add("w-layout-grid", "payment-conf-program-grid", "you-might");
	  
		// Left column container
		const leftCol = document.createElement("div");
	  
		// Upsell tags section
		const upsellDiv = document.createElement("div");
		upsellDiv.classList.add("upsell-div");
	  
		const tagWrapper = document.createElement("div");
		tagWrapper.classList.add("text-block-wrapper-2");
	  
		item.tags.forEach(tag => {
		  const tagDiv = document.createElement("div");
		  tagDiv.classList.add("payment-conf-tag", "bg-color-light-blue");
		  tagDiv.textContent = tag.name;
		  tagDiv.style.backgroundColor = tag.color
		  tagWrapper.appendChild(tagDiv);
		});
	  
		upsellDiv.appendChild(tagWrapper);
		leftCol.appendChild(upsellDiv);
	  
		// Title
		const campTitleWrapper = document.createElement("div");
		const campTitle = document.createElement("div");
		campTitle.classList.add("camp-name-2", "margin-bottom-5");
		campTitle.textContent = item.label;
		campTitleWrapper.appendChild(campTitle);
		leftCol.appendChild(campTitleWrapper);
	  
		// Price Info
		const priceWrapper = document.createElement("div");
		priceWrapper.classList.add("price-wrapper", "upsell");
	  
		const saveItem = document.createElement("div");
		saveItem.classList.add("price-item");
		saveItem.id = "w-node-d9e089fb-dbb6-8c3c-781b-f2cfa37c0c51-f602461b";
	  
		const saveLabel = document.createElement("div");
		saveLabel.classList.add("save-amount-2");
		saveLabel.textContent = "Save";
	  
		const saveAmount = document.createElement("div");
		saveAmount.classList.add("save-amount-2");
		saveAmount.textContent = "$" + (parseFloat(item.disc_amount) - parseFloat(item.amount)).toFixed(2);
	  
		saveItem.appendChild(saveLabel);
		saveItem.appendChild(saveAmount);
	  
		const originalItem = document.createElement("div");
		originalItem.classList.add("price-item", "upsell");
	  
		const originalPrice = document.createElement("div");
		originalPrice.classList.add("original-price");
		originalPrice.textContent = "$" + parseFloat(item.disc_amount).toFixed(2);
		originalItem.appendChild(originalPrice);
	  
		const discountedItem = document.createElement("div");
		discountedItem.classList.add("price-item", "upsell");
	  
		const discountedPrice = document.createElement("div");
		discountedPrice.classList.add("discounted-price-2", "text-blue");
		discountedPrice.textContent = "$" + parseFloat(item.amount).toFixed(2);
		discountedItem.appendChild(discountedPrice);
	  
		priceWrapper.appendChild(saveItem);
		priceWrapper.appendChild(originalItem);
		priceWrapper.appendChild(discountedItem);
		leftCol.appendChild(priceWrapper);
	  
		// Right column buttons
		const buttonDiv = document.createElement("div");
		buttonDiv.classList.add("button-div", "you-might-buttons-wrapper");
	  
		const addToCartBtn = document.createElement("a");
		addToCartBtn.href = "#";
		let programClass = "supp_program_"+item.programDetailId;
		addToCartBtn.classList.add("main-button", "red", "add-to-card", "you-might-add-to-cart", "w-button", programClass);
		addToCartBtn.textContent = "Add to Cart";
		const learnMoreBtn = document.createElement("a");
		if(item.benefits.length > 0){
			learnMoreBtn.href = "#";
			learnMoreBtn.classList.add("main-button", "learn-more", "w-button");
			learnMoreBtn.textContent = "Learn More";
		
			learnMoreBtn.addEventListener("click", function (e) {
			e.preventDefault();
			this.$selectedProgram = item;
			this.hideShowModalContent(item);
			this.showModal();
			}.bind(this));
		}else{
			learnMoreBtn.classList.add("width-100");
		}


		const checkboxDiv = document.createElement("div");

		const input = document.createElement("input");
		
		input.classList.add("w-checkbox-input", "core-checkbox", "suppCheckbox", "hide");
		input.type = "checkbox";
		input.id = size + item.label.replace(/\s+/g, '-').toLowerCase();
		input.name = "checkbox";
		input.value = item.amount;
		input.setAttribute("programdetailid", item.programDetailId);
		input.setAttribute("data-name", "Checkbox");
		var $this = this;
		input.addEventListener("change", function () {
			this.checked ? slideDiv.classList.add('border-red') : slideDiv.classList.remove('border-red')
			$this.updateAmount(this, item.amount);
		})

		checkboxDiv.appendChild(input);
		
	  
		buttonDiv.appendChild(addToCartBtn);
		
		buttonDiv.appendChild(learnMoreBtn);
		buttonDiv.appendChild(checkboxDiv)
	  
		gridDiv.appendChild(leftCol);
		gridDiv.appendChild(buttonDiv);
	  
		// Benefits Section (separate div)
		const benefitsContainer = document.createElement("div");
		if(item.benefits.length > 0){
		
			const marginTopDiv = document.createElement("div");
			marginTopDiv.classList.add("margin-top");
		
			const keyLabel = document.createElement("div");
			keyLabel.classList.add("dm-sans", "key-benefits");
			keyLabel.innerHTML = "Key Benefits<br />";
		
			const benefitsWrapper = document.createElement("div");
		
			item.benefits.forEach((benefit, index) => {
				const benefitWrapper = document.createElement("div");
				benefitWrapper.classList.add("key-benefits-grid-wrapper");
				if (index === 0) benefitWrapper.classList.add("center");
			
				const img = document.createElement("img");
				img.src = "https://cdn.prod.website-files.com/6271a4bf060d543533060f47/67cec6d2f47c8a1eee15da7e_library_books.svg";
				img.loading = "lazy";
				img.alt = "";
				img.classList.add("full-width-inline-image");
			
				const benefitText = document.createElement("div");
				benefitText.classList.add("dm-sans");
				benefitText.innerHTML = benefit.title + "<br />";
			
				benefitWrapper.appendChild(img);
				benefitWrapper.appendChild(benefitText);
			
				benefitsWrapper.appendChild(benefitWrapper);
			});
		
			marginTopDiv.appendChild(keyLabel);
			marginTopDiv.appendChild(benefitsWrapper);
			benefitsContainer.appendChild(marginTopDiv);
		}
	  
		// Return full fragment
		const wrapper = document.createElement("div");
		wrapper.appendChild(gridDiv);
		if(item.benefits.length > 0){
			wrapper.appendChild(benefitsContainer);
		}
	  
		return wrapper;
	  }
	  

	displayModalSuppProgram(item, type = "banner", size="desktop") {
		console.log("displayModalSuppProgram");
		var $this = this;
		let discount_amount = item.disc_amount - item.amount;
		let discount = Number.isInteger(discount_amount)
		  ? discount_amount
		  : parseFloat(discount_amount).toFixed(2);
		let typeClass = "modal-content " + type + "-" + item.programDetailId;
		// Main wrapper
		if (type == "banner") {
		  var slideItem = creEl("div", "supp-programs-slide-item");
		} else {
		  var slideItem = creEl(
			"div",
			"supp-programs-description-div " + typeClass
		  );
		}
	
		// --------- Discounted Programs Div ---------
		var programsDiv = creEl("div", "discounted-programs-div border-none");
	
		// Title
		var title = creEl("div", "dm-sans bold-700 text-large-with-mb");
		title.innerHTML = item.label;
	
		// Price Grid
		var priceGrid = creEl("div", "discount-price-grid supp-prog-price");
	
		var originalPrice = creEl("div", "original-price-gray medium-text");
		originalPrice.textContent = "$" + item.disc_amount;
	
		var discountPrice = creEl("div", "discount-price supp-program");
		discountPrice.innerHTML = "$" + item.amount + "<br />";
	
		var savePriceText = creEl("div", "save-price-text");
		var saveAmount = creEl("div", "save-amount medium-text");
		saveAmount.textContent = "Save " + "$" + discount;
		savePriceText.appendChild(saveAmount);
	
		priceGrid.appendChild(originalPrice);
		priceGrid.appendChild(discountPrice);
		priceGrid.appendChild(savePriceText);
	
		// Benefits Data
		var benefits = item.benefits;
		if (benefits.length > 0) {
			// Key Benefits label
			var keyBenefitsLabel = creEl("div", "dm-sans key-benefits");
			keyBenefitsLabel.innerHTML = "Key Benefits<br />";
		
			// Benefits container
			var benefitsContainer = creEl("div", "width-100");
		
			
		
			// Loop benefits
			if (benefits.length > 0) {
			benefits.forEach(function (benefit) {
				var benefitWrapper = creEl("div", "key-benefits-grid-wrapper");
		
				var benefitImg = creEl(
				"img",
				"full-width-inline-image margintop-5px"
				);
				benefitImg.src =
				"https://cdn.prod.website-files.com/6271a4bf060d543533060f47/67cec6d2f47c8a1eee15da7e_library_books.svg";
				benefitImg.loading = "lazy";
				benefitImg.alt = "";
		
				var benefitContent = creEl("div");
		
				var benefitTitle = creEl(
				"div",
				"dm-sans margin-bottom-5 bold-700"
				);
				benefitTitle.innerHTML = benefit.title + "<br />";
		
				var benefitDesc = creEl("div", "dm-sans");
				benefitDesc.innerHTML = benefit.desc;
		
				benefitContent.appendChild(benefitTitle);
				benefitContent.appendChild(benefitDesc);
		
				benefitWrapper.appendChild(benefitImg);
				benefitWrapper.appendChild(benefitContent);
		
				benefitsContainer.appendChild(benefitWrapper);
			});
			}
		}
	
		// Buttons
		var buttonDiv = creEl(
		  "div",
		  "button-div button-grid-wrapper-with-margin-top"
		);
		
		let programClass = "supp_program_"+item.programDetailId;
		var buyNowBtn = creEl("a", "main-button red add-to-card supp-program w-button "+programClass);
		buyNowBtn.href = "#";
		buyNowBtn.textContent = "Add to Cart";
		// buyNowBtn.addEventListener("click", function (event) {
		//   event.preventDefault();
		//   $this.$selectedProgram = item;
		//   //$this.updatePayNowModelAmount();
		//   const buyNowModal = document.getElementById("buyNowModal");
		//   $this.showModal(buyNowModal);
		// });
	
		var learnMoreBtn = creEl("a", "main-button close w-button");
		if (benefits.length > 0) {
			learnMoreBtn.href = "#";
			learnMoreBtn.textContent = type == "banner" ? "Learn More" : "Close";
			learnMoreBtn.addEventListener("click", function (event) {
			event.preventDefault();
			$this.$selectedProgram = item;
			const suppProgramsModal = document.getElementById("suppProgramsModal");
			if (type == "banner") {
				$this.hideShowModalContent(item);
				$this.showModal(suppProgramsModal);
			} else {
				$this.hideModal(suppProgramsModal);
			}
			});
		}

		// Checkbox added for add to cart feature
		// Create the checkbox
		const checkboxDiv = document.createElement("div");
		const input = document.createElement("input");
		input.classList.add("w-checkbox-input", "core-checkbox", "suppCheckbox", "hide");
		input.type = "checkbox";
		input.id = size + item.label.replace(/\s+/g, '-').toLowerCase();
		input.name = "checkbox";
		input.value = item.amount;
		input.setAttribute("programdetailid", item.programDetailId);
		input.setAttribute("data-name", "Checkbox");
		var $this = this;
		input.addEventListener("change", function () {
			this.checked ? slideDiv.classList.add('border-red') : slideDiv.classList.remove('border-red')
			$this.updateAmount(this, item.amount);
		})

		checkboxDiv.appendChild(input);
	
		buttonDiv.appendChild(buyNowBtn);
		if (benefits.length > 0) {
			buttonDiv.appendChild(learnMoreBtn);
		}
		buttonDiv.appendChild(checkboxDiv);
	
		// Assemble programsDiv
		programsDiv.appendChild(title);
		programsDiv.appendChild(priceGrid);
		if (benefits.length > 0) {
			programsDiv.appendChild(keyBenefitsLabel);
			programsDiv.appendChild(benefitsContainer);
		}
		programsDiv.appendChild(buttonDiv);
	
		// --------- Gradient Div Section ---------
		var gradientDiv = creEl(
		  "div",
		  "gradient-div-supp-programs-modal mob-hide"
		);
	
		// Image
		var gradientImg = creEl("img", "supp-programs-img");
		gradientImg.src =
		  "https://cdn.prod.website-files.com/6271a4bf060d543533060f47/67d291810bb6fac1cea50637_supp-prog-2.avif";
		gradientImg.loading = "lazy";
		gradientImg.alt = "";
	
		// Text
		var gradientText = creEl("div", "supp-programs-text");
	
		var percentOff = creEl("div", "dm-sans percent-off");
		percentOff.innerHTML =
		  "$" + discount + '<span class="off-text-shadow-right-white"> OFF</span>';
	
		var limitedTime = creEl("div", "dm-sans limited-time-supp-program");
		limitedTime.textContent = "Limited Time Offer";
	
		gradientText.appendChild(percentOff);
		gradientText.appendChild(limitedTime);
	
		// Assemble gradientDiv
		gradientDiv.appendChild(gradientImg);
		gradientDiv.appendChild(gradientText);
	
		// --------- Assemble Main Div ---------
		slideItem.appendChild(programsDiv);
		slideItem.appendChild(gradientDiv);
	
		return slideItem;
	  }

	hideShowModalContent(item) {
		const modelContent = document.querySelectorAll(".modal-content");
		for (let index = 0; index < modelContent.length; index++) {
			const element = modelContent[index];
			element.classList.add("hide");
		}
		document
			.querySelector(".modal-content.modal-" + item.programDetailId)
			.classList.remove("hide");
	}
	displayStudentInfo(display){
		document.querySelectorAll('.student-info-container').forEach(el=>el.style.display = display)
		var localCheckOutData = localStorage.getItem('checkOutBasicData')
		if(localCheckOutData != undefined){
			localCheckOutData = JSON.parse(localCheckOutData);
			let firstNameEls = document.querySelectorAll("[data-student='first-name']")
			if (firstNameEls.length > 0) {
				firstNameEls.forEach(El => {
					El.innerHTML = localCheckOutData.firstName;
				})
			}

			let lastNameEls = document.querySelectorAll("[data-student='last-name']")
			if (lastNameEls.length > 0) {
				lastNameEls.forEach(El => {
					El.innerHTML = localCheckOutData.lastName;
				})
			}

			let emailEls = document.querySelectorAll("[data-student='email']")
			if (emailEls.length > 0) {
				emailEls.forEach(El => {
					El.innerHTML = localCheckOutData.studentEmail;
				})
			}
			
			let schoolEls = document.querySelectorAll("[data-student='school']")
			if (schoolEls.length > 0) {
				schoolEls.forEach(El => {
					El.innerHTML = localCheckOutData.school;
				})
			}

			let gradeEls = document.querySelectorAll("[data-student='grade']")
			if (gradeEls.length > 0) {
				gradeEls.forEach(El => {
					El.innerHTML = localCheckOutData.grade;
				})
			}

			let genderEls = document.querySelectorAll("[data-student='gender']")
			if (genderEls.length > 0) {
				genderEls.forEach(El => {
					El.innerHTML = localCheckOutData.gender;
				})
			}

			
		}
	}
	updateCheckOutData(checkoutData) {	
		var localCheckoutData = localStorage.getItem('checkOutData');
		if(checkoutData != null && localCheckoutData != null){
			checkoutData = {
				...JSON.parse(localCheckoutData),
				...checkoutData
			}
		}
		localStorage.setItem("checkOutData", JSON.stringify(checkoutData));
	}
}

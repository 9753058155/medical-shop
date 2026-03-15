/*
  i18n.js — Language / Translation system
  
  HOW IT WORKS:
  - All UI text is stored here in both Hindi and English
  - Components call useLanguage() to get current language + t() function
  - t('key') returns the text in current language
  - Language preference saved in localStorage
*/

import { createContext, useContext } from 'react'

// ── All translations ──
export const translations = {
  en: {
    // App general
    appName:        'MedShop Manager',
    appSub:         'Medical Shop Manager',
    loading:        'Loading shop data...',
    save:           'Save',
    cancel:         'Cancel',
    edit:           'Edit',
    delete:         'Delete',
    add:            'Add',
    search:         'Search...',
    all:            'All',
    yes:            'Yes',
    no:             'No',
    close:          'Close',
    optional:       'optional',
    required:       'required',

    // Nav
    home:           'Home',
    products:       'Products',
    sell:           'Sell',
    udhaar:         'Udhaar',
    more:           'More',
    wholesalers:    'Wholesalers',
    reports:        'Reports',
    reorder:        'Reorder List',
    purchase:       'Purchase Entry',
    returns:        'Returns',
    profit:         'Profit',
    logout:         'Lock / Logout',

    // Dashboard
    goodMorning:    'Good Morning',
    goodAfternoon:  'Good Afternoon',
    goodEvening:    'Good Evening',
    shopOverview:   'Shop Overview',
    totalProducts:  'Total Products',
    lowStock:       'Low Stock',
    outOfStock:     'Out of Stock',
    todaySales:     'Today\'s Sales',
    todayRevenue:   "Today's Revenue",
    discountGiven:  'discount given',
    paymentDue:     'Payment Due Today!',
    expiryAlerts:   'Expiry Alerts',
    lowStockAlert:  'Low Stock Alert',
    recentSales:    'Recent Sales',
    seeAll:         'See all →',
    allGood:        'All stocks are sufficient!',
    noSalesToday:   'No sales recorded today',

    // Products
    addProduct:     'Add / Update Product',
    searchMed:      'Search medicine...',
    medicineNameLbl:'Medicine Name',
    category:       'Category',
    sellUnit:       'Sell Unit',
    stripSettings:  'Strip Settings',
    tabletsPerStrip:'Tablets per Strip',
    addStrips:      'Add Strips (from wholesaler)',
    addStock:       'Add Stock',
    lowAlert:       'Low Stock Alert',
    buyPrice:       'Buy Price ₹',
    sellPrice:      'Sell Price ₹ (per unit)',
    expiryDate:     'Expiry Date (MM/YYYY)',
    expiryHint:     'Leave blank if no expiry',
    wholesaler:     'Wholesaler',
    noProducts:     'No products found',

    // Sell
    newSale:        'New Sale',
    workerName:     'Worker Name',
    customerName:   'Customer Name',
    customerPhone:  'Phone (WhatsApp)',
    items:          'Items',
    addItem:        '+ Add Item',
    paymentMethod:  'Payment Method',
    cash:           'Cash',
    upi:            'UPI',
    subtotal:       'Subtotal',
    discount:       'Discount',
    saving:         'Saving',
    total:          'Total',
    completeSale:   'Complete Sale',
    todayLog:       "Today's Sales Log",
    summary:        'Summary',
    noSalesYet:     'No sales yet today',
    whatsappBill:   'WhatsApp Bill',
    udhaarSaved:    'saved to Udhaar tracker',

    // Udhaar
    udhaarTitle:    'Udhaar Tracker',
    totalUdhaar:    'Total Outstanding',
    addUdhaar:      'Add Udhaar',
    unpaid:         'Unpaid',
    paid:           'Paid',
    fullPayment:    'Full Payment',
    partial:        'Partial',
    whatsappRemind: 'WhatsApp Remind',
    noUdhaar:       'No pending udhaar!',
    amountDue:      'Amount Due ₹',
    amountReceived: 'Amount Received',
    confirmPayment: 'Confirm Payment',

    // Wholesalers
    addWholesaler:  'Add Wholesaler',
    paymentDueTod:  'Due Today',
    dueSoon:        'Due Soon',

    // Reorder
    reorderTitle:   'Reorder List',
    needsRestock:   'medicines need restocking',
    sendFullList:   'Send Full List on WhatsApp',
    allSufficient:  'All stocks are sufficient!',
    noReorderNeeded:'No reorder needed right now',

    // Purchase
    purchaseTitle:  'Purchase Entry',
    recordStock:    'Record stock received from wholesaler',
    selectWholesaler: 'Select Wholesaler',
    invoiceNo:      'Invoice / Bill Number',
    medReceived:    'Medicines Received',
    stripsReceived: 'Strips Received',
    qtyReceived:    'Qty Received',
    buyPriceStrip:  'Buy Price ₹ / strip',
    totalCost:      'Total Cost',
    savePurchase:   'Save Purchase & Update Stock',
    recentPurchases:'Recent Purchases',

    // Returns
    returnsTitle:   'Returns / Refunds',
    customerReturn: 'Customer returned medicine',
    selectSale:     "Select from Today's Sales",
    itemsToReturn:  'Items to Return',
    returnQty:      'Return qty',
    notes:          'Notes / Reason',
    totalRefund:    'Total Refund',
    recordReturn:   'Record Return & Restore Stock',
    returnHistory:  'Return History',

    // Profit
    profitTitle:    'Profit Report',
    marginPerMed:   'Margin & earnings per medicine',
    revenue:        'Revenue',
    estProfit:      'Est. Profit',
    mostProfitable: 'Most Profitable',
    marginPerMedLbl:'Margin per Medicine',
    lowMarginWarn:  '⚠️ Low Margin Medicines',

    // Phone validation
    phoneInvalid:   'Enter valid 10-digit Indian mobile number',
    phoneValid:     'Valid number ✓',
  },

  hi: {
    // App general
    appName:        'मेडशॉप मैनेजर',
    appSub:         'मेडिकल शॉप मैनेजर',
    loading:        'डेटा लोड हो रहा है...',
    save:           'सेव करें',
    cancel:         'रद्द करें',
    edit:           'संपादित करें',
    delete:         'हटाएं',
    add:            'जोड़ें',
    search:         'खोजें...',
    all:            'सभी',
    yes:            'हाँ',
    no:             'नहीं',
    close:          'बंद करें',
    optional:       'वैकल्पिक',
    required:       'आवश्यक',

    // Nav
    home:           'होम',
    products:       'उत्पाद',
    sell:           'बिक्री',
    udhaar:         'उधार',
    more:           'अधिक',
    wholesalers:    'थोक विक्रेता',
    reports:        'रिपोर्ट',
    reorder:        'रीऑर्डर लिस्ट',
    purchase:       'खरीद एंट्री',
    returns:        'वापसी',
    profit:         'मुनाफा',
    logout:         'लॉक / लॉगआउट',

    // Dashboard
    goodMorning:    'सुप्रभात',
    goodAfternoon:  'नमस्कार',
    goodEvening:    'शुभ संध्या',
    shopOverview:   'दुकान का हाल',
    totalProducts:  'कुल उत्पाद',
    lowStock:       'कम स्टॉक',
    outOfStock:     'स्टॉक खत्म',
    todaySales:     'आज की बिक्री',
    todayRevenue:   'आज की कमाई',
    discountGiven:  'छूट दी गई',
    paymentDue:     'आज भुगतान देना है!',
    expiryAlerts:   'समाप्ति तिथि अलर्ट',
    lowStockAlert:  'कम स्टॉक अलर्ट',
    recentSales:    'हाल की बिक्री',
    seeAll:         'सभी देखें →',
    allGood:        'सभी स्टॉक पर्याप्त हैं!',
    noSalesToday:   'आज कोई बिक्री नहीं',

    // Products
    addProduct:     'उत्पाद जोड़ें / अपडेट करें',
    searchMed:      'दवाई खोजें...',
    medicineNameLbl:'दवाई का नाम',
    category:       'श्रेणी',
    sellUnit:       'बिक्री इकाई',
    stripSettings:  'स्ट्रिप सेटिंग',
    tabletsPerStrip:'प्रति स्ट्रिप गोलियां',
    addStrips:      'स्ट्रिप जोड़ें (थोक से)',
    addStock:       'स्टॉक जोड़ें',
    lowAlert:       'कम स्टॉक अलर्ट',
    buyPrice:       'खरीद मूल्य ₹',
    sellPrice:      'बिक्री मूल्य ₹ (प्रति इकाई)',
    expiryDate:     'समाप्ति तिथि (MM/YYYY)',
    expiryHint:     'कोई तिथि नहीं है तो खाली छोड़ें',
    wholesaler:     'थोक विक्रेता',
    noProducts:     'कोई उत्पाद नहीं मिला',

    // Sell
    newSale:        'नई बिक्री',
    workerName:     'कर्मचारी का नाम',
    customerName:   'ग्राहक का नाम',
    customerPhone:  'फोन (WhatsApp)',
    items:          'सामान',
    addItem:        '+ आइटम जोड़ें',
    paymentMethod:  'भुगतान का तरीका',
    cash:           'नकद',
    upi:            'यूपीआई',
    subtotal:       'उप-कुल',
    discount:       'छूट',
    saving:         'बचत',
    total:          'कुल',
    completeSale:   'बिक्री पूरी करें',
    todayLog:       'आज का रिकॉर्ड',
    summary:        'सारांश',
    noSalesYet:     'आज अभी कोई बिक्री नहीं',
    whatsappBill:   'WhatsApp बिल',
    udhaarSaved:    'उधार ट्रैकर में सेव हुआ',

    // Udhaar
    udhaarTitle:    'उधार ट्रैकर',
    totalUdhaar:    'कुल बाकी राशि',
    addUdhaar:      'उधार जोड़ें',
    unpaid:         'बाकी',
    paid:           'चुकाया',
    fullPayment:    'पूरा भुगतान',
    partial:        'आंशिक',
    whatsappRemind: 'WhatsApp याद दिलाएं',
    noUdhaar:       'कोई बाकी उधार नहीं!',
    amountDue:      'बाकी राशि ₹',
    amountReceived: 'मिली राशि',
    confirmPayment: 'भुगतान पक्का करें',

    // Wholesalers
    addWholesaler:  'थोक विक्रेता जोड़ें',
    paymentDueTod:  'आज देना है',
    dueSoon:        'जल्द देना है',

    // Reorder
    reorderTitle:   'रीऑर्डर लिस्ट',
    needsRestock:   'दवाइयों को स्टॉक चाहिए',
    sendFullList:   'पूरी लिस्ट WhatsApp पर भेजें',
    allSufficient:  'सभी स्टॉक पर्याप्त हैं!',
    noReorderNeeded:'अभी कोई रीऑर्डर नहीं चाहिए',

    // Purchase
    purchaseTitle:  'खरीद एंट्री',
    recordStock:    'थोक विक्रेता से मिला स्टॉक दर्ज करें',
    selectWholesaler:'थोक विक्रेता चुनें',
    invoiceNo:      'बिल / इनवॉइस नंबर',
    medReceived:    'मिली दवाइयां',
    stripsReceived: 'मिली स्ट्रिप',
    qtyReceived:    'मिली मात्रा',
    buyPriceStrip:  'खरीद मूल्य ₹ / स्ट्रिप',
    totalCost:      'कुल लागत',
    savePurchase:   'खरीद सेव करें और स्टॉक अपडेट करें',
    recentPurchases:'हाल की खरीद',

    // Returns
    returnsTitle:   'वापसी / रिफंड',
    customerReturn: 'ग्राहक ने दवाई वापस की',
    selectSale:     'आज की बिक्री से चुनें',
    itemsToReturn:  'वापस करने वाली दवाइयां',
    returnQty:      'वापसी मात्रा',
    notes:          'नोट्स / कारण',
    totalRefund:    'कुल वापसी',
    recordReturn:   'वापसी दर्ज करें और स्टॉक वापस करें',
    returnHistory:  'वापसी का इतिहास',

    // Profit
    profitTitle:    'मुनाफा रिपोर्ट',
    marginPerMed:   'प्रति दवाई मार्जिन और कमाई',
    revenue:        'कमाई',
    estProfit:      'अनुमानित मुनाफा',
    mostProfitable: 'सबसे ज्यादा मुनाफा',
    marginPerMedLbl:'प्रति दवाई मार्जिन',
    lowMarginWarn:  '⚠️ कम मार्जिन वाली दवाइयां',

    // Phone validation
    phoneInvalid:   '10 अंकों का सही मोबाइल नंबर डालें',
    phoneValid:     'सही नंबर ✓',
  }
}

// ── Language Context ──
export const LanguageContext = createContext(null)
export const useLanguage = () => useContext(LanguageContext)

// ── Phone validation helper ──
// Valid Indian mobile: 10 digits, starts with 6, 7, 8, or 9
export const validatePhone = (phone) => {
  const cleaned = phone.replace(/\s/g, '')
  if (!cleaned) return { valid: true, msg: '' }  // empty is ok (optional)
  const regex = /^[6-9]\d{9}$/
  return {
    valid: regex.test(cleaned),
    msg:   regex.test(cleaned) ? '' : 'Invalid number'
  }
}

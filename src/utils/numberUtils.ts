// Utility functions for handling Arabic and English numbers

// Map Arabic digits to English digits
const arabicToEnglishMap: { [key: string]: string } = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9'
};

// Convert Arabic numerals to English numerals
export const convertArabicToEnglish = (input: string): string => {
  return input.replace(/[٠-٩]/g, (match) => arabicToEnglishMap[match] || match);
};

// Format price input to only allow numbers
export const formatPriceInput = (input: string): string => {
  // Convert Arabic numerals to English
  const englishNumbers = convertArabicToEnglish(input);
  
  // Remove any non-numeric characters except decimal point
  const numbersOnly = englishNumbers.replace(/[^\d.]/g, '');
  
  // Ensure only one decimal point
  const parts = numbersOnly.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return numbersOnly;
};

// Validate if the price is a valid number
export const isValidPrice = (price: string): boolean => {
  const numericPrice = parseFloat(price);
  return !isNaN(numericPrice) && numericPrice > 0;
};
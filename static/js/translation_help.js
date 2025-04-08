document.addEventListener('DOMContentLoaded', function() {
  const getWordButton = document.getElementById('getWordButton');
  const submitButton = document.getElementById('submitTranslationButton');
  const nonsenseButton = document.getElementById('nonsenseButton');
  const translationInput = document.getElementById('translationInput');
  const englishWordSpan = document.getElementById('englishWord');
  const translatedWordSpan = document.getElementById('translatedWord');
  const separator = document.getElementById('separator');
  const difficultySelect = document.getElementById('difficultySelect');
  const submissionStatus = document.getElementById('submissionStatus');
  const wordContainer = document.getElementById('wordContainer');

  // On page load, display default text.
  englishWordSpan.textContent = "SELECT LANGUAGE";

  // Function to fetch a random word.
  function fetchRandomWord() {
    const lang = document.getElementById('languageSelect').value;
    fetch(`/get_random_word?lang=${lang}`)
      .then(response => response.json())
      .then(data => {
        // Remove the "centered" class so the container splits.
        wordContainer.classList.remove("centered");
        // Display the English word (aligned right) and the translation.
        englishWordSpan.textContent = data.word.toUpperCase();
        translatedWordSpan.textContent = (data.existing_translation && data.existing_translation !== "Translation not available.")
                                          ? data.existing_translation
                                          : "N/A";
        // Show the separator.
        separator.style.display = "inline";
        // Set the difficulty dropdown based on the word's difficulty.
        if (data.difficulty !== undefined) {
          difficultySelect.value = data.difficulty.toString();
        }
      })
      .catch(error => console.error("Error:", error));
  }

  // When "Get Word" is clicked.
  getWordButton.addEventListener('click', function(){
    fetchRandomWord();
  });

  // Function to submit the translation.
  function submitTranslation() {
    const lang = document.getElementById('languageSelect').value;
    const word = englishWordSpan.textContent;
    const translation = translationInput.value.trim();
    const diffValue = difficultySelect.value;
    if (!word || word === "SELECT LANGUAGE") {
      alert("Please get a word first.");
      return;
    }
    if (!translation) {
      alert("Please enter a translation.");
      return;
    }
    fetch(`/submit_translation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word, language: lang, translation: translation, difficulty: diffValue })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        submissionStatus.textContent = "Translation submitted successfully!";
        translationInput.value = "";
        fetchRandomWord();
      } else {
        submissionStatus.textContent = "Error: " + data.error;
      }
    })
    .catch(error => console.error("Error:", error));
  }

  // Submit on button click.
  submitButton.addEventListener('click', submitTranslation);

  // Also submit on Enter key.
  translationInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitTranslation();
    }
  });

  // When "Nonsense" is clicked, mark the word as nonsense.
  nonsenseButton.addEventListener('click', function(){
    const lang = document.getElementById('languageSelect').value;
    const word = englishWordSpan.textContent;
    if (!word || word === "SELECT LANGUAGE") {
      alert("No word to mark as nonsense.");
      return;
    }
    fetch(`/submit_nonsense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word, language: lang })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        submissionStatus.textContent = "Nonsense submitted successfully!";
        translationInput.value = "";
        fetchRandomWord();
      } else {
        submissionStatus.textContent = "Error: " + data.error;
      }
    })
    .catch(error => console.error("Error:", error));
  });
});

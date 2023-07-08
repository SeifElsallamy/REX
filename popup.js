let regexPatterns = []; // Array to store the regex patterns

// Retrieve the saved regex patterns from storage
chrome.storage.sync.get("regexPatterns", function (data) {
  regexPatterns = data.regexPatterns || [];
  displayRegexPatterns(regexPatterns);
  applyRegexToCurrentPage();
});

// Event listener for the regex form submission
document.getElementById("regexForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const regexInput = document.getElementById("regexInput").value;
  saveAndApplyRegex(regexInput);
  document.getElementById("regexInput").value = ""; // Clear the input field
});

// Apply the regex patterns to the current page
function applyRegexToCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTabId = tabs[0].id;

    // Execute content script to capture script URLs on the current page
    chrome.scripting.executeScript(
      {
        target: { tabId: currentTabId },
        function: captureScriptUrls,
      },
      function (result) {
        const scriptUrls = result[0].result;
        const pageContentPromise = fetchUrlContent(tabs[0].url);
        const scriptContentsPromises = scriptUrls.map(fetchUrlContent);

        Promise.all([pageContentPromise, ...scriptContentsPromises])
          .then((responses) => {
            const contents = responses.map((response, index) => ({
              url: index === 0 ? tabs[0].url : scriptUrls[index - 1],
              content: response,
            }));
            const matchedWords = matchWordsWithRegex(contents, regexPatterns);
            const uniqueMatchedWords = removeDuplicates(matchedWords);
            displayMatchedWords(uniqueMatchedWords);
          })
          .catch((error) => {
            console.error("Error occurred while fetching script contents:", error);
          });
      }
    );
  });
}

// Capture script URLs from the current page
function captureScriptUrls() {
  const scriptTags = Array.from(document.querySelectorAll("script[src]"));
  const scriptUrls = scriptTags.map((script) => script.src);
  return scriptUrls;
}

// Fetch the content of a URL
function fetchUrlContent(url) {
  return fetch(url)
    .then((response) => {
      //if (!response.ok) {
      //  throw new Error(`Error fetching URL: ${url}`);
      //}
      return response.text();
    })
    .catch((error) => {
      console.error(`Error occurred while fetching URL: ${url}`, error);
    });
}

// Apply the regex patterns to script contents and return matched words
function matchWordsWithRegex(contents, regexPatterns) {
  const matchedWords = [];

  regexPatterns.forEach((pattern) => {
    const regex = new RegExp(pattern, "gi");

    contents.forEach((content) => {
      const matches = content.content.match(regex);
      if (matches) {
        matches.forEach((match) => {
          matchedWords.push({ pattern, content, match });
        });
      }
    });
  });

  return matchedWords;
}

// Save and apply the regex pattern
function saveAndApplyRegex(pattern) {
  regexPatterns.push(pattern);
  chrome.storage.sync.set({ regexPatterns }, function () {
    // Apply the updated regex patterns to the captured URLs after saving
    applyRegexToCurrentPage();
    displayRegexPatterns(regexPatterns);
  });
}

// Remove duplicate results
function removeDuplicates(matchedWords) {
  const uniqueMatches = [];
  const uniqueKeys = new Set();

  matchedWords.forEach((matched) => {
    const key = `${matched.pattern}|${matched.content.url}|${matched.match}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniqueMatches.push(matched);
    }
  });

  return uniqueMatches;
}

// Display the saved regex patterns
function displayRegexPatterns(regexPatterns) {
  const regexList = document.getElementById("regexList");
  regexList.innerHTML = ""; // Clear previous patterns

  regexPatterns.forEach(function (pattern) {
    const patternContainer = document.createElement("div");
    patternContainer.classList.add("regex-item");

    const patternText = document.createElement("span");
    patternText.textContent = pattern;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteRegexPattern(pattern);
    });

    patternContainer.appendChild(patternText);
    patternContainer.appendChild(deleteBtn);
    regexList.appendChild(patternContainer);
  });
}

// Delete a regex pattern
function deleteRegexPattern(pattern) {
  regexPatterns = regexPatterns.filter((p) => p !== pattern);
  chrome.storage.sync.set({ regexPatterns }, function () {
    // Apply the updated regex patterns to the captured URLs after deleting
    applyRegexToCurrentPage();
    displayRegexPatterns(regexPatterns);
  });
}

// Event delegation for deleting a regex pattern
document.getElementById("regexList").addEventListener("click", function (event) {
  if (event.target.nodeName === "BUTTON") {
    const pattern = event.target.parentNode.firstChild.textContent;
    deleteRegexPattern(pattern);
  }
});

// Clear the word list in the popup
function clearWordList() {
  const wordList = document.getElementById("wordList");
  wordList.innerHTML = "";
}

// Display the matched words in the popup
function displayMatchedWords(matchedWords) {
  const wordList = document.getElementById("wordList");
  wordList.innerHTML = ""; // Clear previous results

  if (matchedWords.length === 0) {
    const listItem = document.createElement("li");
    listItem.textContent = "No matched words found.";
    wordList.appendChild(listItem);
  } else {
    let currentPattern = null;
    let currentUrl = null;
    let patternElement = null;
    let urlElement = null;
    let matchesElement = null;

    matchedWords.forEach(function (matched) {
      if (matched.pattern !== currentPattern || matched.content.url !== currentUrl) {
        // Create new elements for the pattern, URL, and matches
        currentPattern = matched.pattern;
        currentUrl = matched.content.url;

        const listItem = document.createElement("li");
        patternElement = document.createElement("span");
        urlElement = document.createElement("a");
        matchesElement = document.createElement("ul");
        matchesElement.classList.add("matches-list");

        //patternElement.textContent = `Regex: ${currentPattern}`;
        urlElement.href = currentUrl;
        urlElement.target = "_blank";
        urlElement.textContent = currentUrl;
        urlElement.style.color = "#ffffff"; // Change the link color to white

        listItem.appendChild(patternElement);
        listItem.appendChild(urlElement);
        listItem.appendChild(matchesElement);
        wordList.appendChild(listItem);
      }

      // Add the match to the matches element
      const matchItem = document.createElement("li");
      matchItem.textContent = matched.match;
      matchesElement.appendChild(matchItem);
    });
  }
}

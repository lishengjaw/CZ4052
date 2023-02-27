require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const validHostNames = {
  "www.youtube.com": "YOUTUBE",
};

async function getUrl() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

async function getUrlObj() {
  const url = await getUrl();
  return new URL(url);
}

async function getTabId() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.id;
}

async function checkValidHostName(url) {
  let urlObj = await getUrlObj();
  return urlObj.hostname in validHostNames;
}

function getYoutubeVideoId(url) {
  const regExp = new RegExp(
    ".*(?:(?:youtu.be/|v/|vi/|u/w/|embed/)|(?:(?:watch)??v(?:i)?=|&v(?:i)?=))([^#&?]*).*",
    "gi"
  );
  return regExp.exec(url)[1];
}

async function getTranscript(type, tabId) {
  if (type === "YOUTUBE") {
    return await getYoutubeTranscript(tabId);
  }
}

async function getYoutubeTranscript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: scrapeYoutubeTranscript_1,
  });

  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: scrapeYoutubeTranscript_2,
  });

  const transcript = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: scrapeYoutubeTranscript_3,
  });

  const filteredTranscript = await chrome.scripting.executeScript({
    args: [transcript[0].result],
    target: { tabId: tabId },
    function: filterTranscript,
  });
  return filteredTranscript[0].result;
}

function scrapeYoutubeTranscript_1() {
  const button = document
    .getElementById("button-shape")
    .querySelector("button");
  button.click();
}

function scrapeYoutubeTranscript_2() {
  const buttons = document.getElementsByClassName(
    "style-scope ytd-menu-service-item-renderer"
  );
  for (let i = buttons.length - 1; i >= 0; i--) {
    if (buttons[i].innerText === "Show transcript") {
      buttons[i].click();
      break;
    }
  }
}

function scrapeYoutubeTranscript_3() {
  const lines = document.getElementsByClassName(
    "segment-text style-scope ytd-transcript-segment-renderer"
  );
  let transcript = "";
  for (let i = 0; i < lines.length; i++) {
    transcript += `${lines[i].innerText} `;
  }
  return transcript;
}

function filterTranscript(transcript) {
  const regExp = new RegExp("\\[.*\\]", "g");
  const splitTranscript = transcript.split(" ");
  const filteredTranscript = splitTranscript.filter((word) => {
    return !regExp.test(word.trim());
  });
  return filteredTranscript.join(" ");
}

function getTitle(type, tabId) {
  if (type === "YOUTUBE") {
    return getYoutubeTitle(tabId);
  }
}

async function getYoutubeTitle(tabId) {
  const title = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    function: scrapeYoutubeTitle,
  });
  return title[0].result;
}

function scrapeYoutubeTitle() {
  document
    .getElementById("super-title")
    .parentElement.querySelector("h1")
    .querySelector("yt-formatted-string").innerText;
}

async function getSummaryFromOpenAI(title, transcript) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Imagine you are 
    I need you to help me summarize a transcript from a YouTube video.
    The title of the video is ${title} and
    the transcript is ${transcript}
  `,
    maxTokens: 100,
  });

  if (response.status === 200) {
    return response.data.choices[0].text;
  } else {
    return "Error occurred, please try again";
  }
}

document
  .getElementById("get-summary-btn")
  .addEventListener("click", async () => {
    document.getElementById("get-summary-btn").disabled = true;

    const url = await getUrl();
    document.getElementById("url").innerHTML = `Url: ${url}`;

    const validHostName = await checkValidHostName(url);
    if (!validHostName) {
      document.getElementById("summary").innerHTML =
        "Video summary not supported for this url";
    } else {
      document.getElementById("summary").innerHTML = "Loading...";
      const urlObj = await getUrlObj();
      const type = validHostNames[urlObj.hostname];
      const tabId = await getTabId();
      const transcript = await getTranscript(type, tabId);
      const title = await getTitle(type, tabId);
      const summary = await getSummaryFromOpenAI(title, transcript);
      document.getElementById("summary").innerHTML = summary;
    }

    document.getElementById("get-summary-btn").disabled = false;
  });

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Builder, By } = require("selenium-webdriver");

const app = express();
app.use(express.json());
app.use(cors());

const videoDurationMapping = {
  short: {
    maxResults: 5,
    maxSummaryLength: {
      "English": 200,
      "Simplified Chinese": 600,
    }
  },
  medium: {
    maxResults: 5,
    maxSummaryLength: {
      "English": 300,
      "Simplified Chinese": 900,
    },
  },
  long: {
    maxResults: 3,
    maxSummaryLength: {
      "English": 500,
      "Simplified Chinese": 1500,
    }
  },
};

app.post("/search", async (req, res) => {
  const { searchTerm, videoDuration, summaryLanguage } = req.body;
  let searchResults = [];
  try {
    const data = await getYoutubeData(searchTerm, videoDuration);

    searchResults = data.items.map(
      ({
        id: { videoId },
        snippet: {
          channelTitle,
          publishedAt,
          title,
          thumbnails: {
            default: { url },
          },
        },
      }) => {
        return {
          channelName: channelTitle,
          link: `${process.env.YOUTUBE_URL}${videoId}`,
          publishedAt,
          title,
          videoId,
          videoThumbnail: url,
        };
      }
    );

    const driver = await new Builder().forBrowser("chrome").build();
    for (let i = 0; i < searchResults.length; i++) {
      const { videoId } = searchResults[i];
      try {
        const { channelThumbnail, transcript } = await scrapeVideo(
          videoId,
          driver
        );
        searchResults[i].channelThumbnail = channelThumbnail;
        searchResults[i].transcript = transcript;
      } catch (err) {}
    }
    await driver.quit();

    for (let i = 0; i < searchResults.length; i++) {
      const { transcript, title } = searchResults[i];
      const maxSummaryLength = videoDurationMapping[videoDuration].maxSummaryLength[summaryLanguage];
      try {
        const { summary, keywords } = await getSummaryAndKeywordsFromTranscript(
          transcript,
          maxSummaryLength,
          summaryLanguage,
          searchTerm,
          title
        );
        searchResults[i].summary = summary;
        searchResults[i].keywords = keywords;
        delete searchResults[i].transcript;
      } catch (err) {}
    }

    res.json(searchResults);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getYoutubeData(searchTerm, videoDuration) {
  const url = `${process.env.YOUTUBE_DATA_API_URL}?key=${process.env.YOUTUBE_DATA_API_KEY}&part=snippet&q=${searchTerm}&videoDuration=${videoDuration}&type=video&relevanceLanguage=en&maxResults=${videoDurationMapping[videoDuration].maxResults}`;
  const response = await fetch(url);

  if (response.ok) {
    return response.json();
  } else {
    throw new Error("Error fetching data from Youtube Data API");
  }
}

async function scrapeVideo(videoId, driver) {
  await driver.get(`${process.env.YOUTUBE_URL}${videoId}`);
  await driver.sleep(5000);

  const channelThumbnail = await retryScrape(driver, scrapeChannelThumbnail);
  const transcript = await retryScrape(
    driver,
    scrapeTranscript,
    retryScrapeTranscript
  );

  return {
    channelThumbnail: channelThumbnail || "",
    transcript: transcript || "",
  };
}

async function retryScrape(driver, scrapeFunction, retryScrapeFunction = null) {
  for (let i = 0; i < 2; i++) {
    try {
      let result;
      if (i == 0 || !retryScrapeFunction) {
        result = await scrapeFunction(driver);
      } else {
        result = await retryScrapeFunction(driver);
      }
      if (result !== "") {
        return result;
      }
    } catch (err) {}
  }
}

async function scrapeChannelThumbnail(driver) {
  const channelThumbnail = await driver.findElement(By.css('[id="img"]'));
  return await channelThumbnail.getAttribute("src");
}

async function scrapeTranscript(driver) {
  const button = await driver.findElement(
    By.css(
      '[class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-button "]'
    )
  );
  await button.click();

  const buttons = await driver.findElements(
    By.css('[class="style-scope ytd-menu-service-item-renderer"]')
  );
  for (const button of buttons) {
    const text = await button.getText();
    if (text === "Show transcript") {
      await button.click();
      break;
    }
  }
  await driver.sleep(1000);

  const transcriptElements = await driver.findElements(
    By.css('[class="segment-text style-scope ytd-transcript-segment-renderer"]')
  );
  let transcript = "";
  for (const transcriptElement of transcriptElements) {
    transcript += `${await transcriptElement.getText()} `;
  }
  return filterTranscript(transcript);
}

async function retryScrapeTranscript(driver) {
  const transcriptElements = await driver.findElements(
    By.css('[class="segment-text style-scope ytd-transcript-segment-renderer"]')
  );
  let transcript = "";
  for (const transcriptElement of transcriptElements) {
    transcript += `${await transcriptElement.getText()} `;
  }
  return filterTranscript(transcript);
}

function filterTranscript(transcript) {
  const regExp = new RegExp("\\[.*\\]", "g");
  const splitTranscript = transcript.split(" ");
  const filteredTranscript = splitTranscript.filter((word) => {
    return !regExp.test(word.trim());
  });
  return filteredTranscript.join(" ");
}

async function getSummaryAndKeywordsFromTranscript(
  transcript,
  maxTokens,
  summaryLanguage,
  searchTerm,
  title
) {
  if (!transcript) {
    return {
      summary: transcript,
      keywords: [],
    };
  }
  const response = await fetch(process.env.OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-davinci-003",
      prompt: `We introduce Extreme TLDR Generation, a new form of extreme
        summarization given a YouTube video transcript. TLDR Generation involves 
        high source compression, removes stop words and summarizes the transcript whilst 
        retaining meaning.
        
        The video is about ${searchTerm} and is titled ${title}.
        
        Provide the extreme TLDR of the following video transcript in only ${summaryLanguage} with the label "TLDR:": ${transcript}.
        
        Also provide a list of keywords only from the TLDR above with the label "Keywords:".

        The TLDR and list of keywords must be in ${maxTokens} or less tokens.
        `,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    const match = new RegExp("TLDR: (.*)Keywords: (.*).?", "g").exec(
      data.choices[0].text.replace(new RegExp("\n", "g"), " ")
    );
    const split_keywords = match[2].trim().split(new RegExp("[，,]", "g"));
    const trim_keywords = split_keywords.map((keyword) => keyword.trim());
    return {
      summary: match[1].trim(),
      keywords: trim_keywords,
    };
  } else {
    throw new Error("Error getting summary from OpenAI");
  }
}

app.listen(process.env.PORT);

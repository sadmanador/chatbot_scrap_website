const dotenv = require('dotenv');
dotenv.config();

const cheerio = require('cheerio');
const request = require('request');
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence, RunnablePassthrough } = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");

const openApiKey = process.env.OPENAI_API_KEY;
const model = new ChatOpenAI({ apiKey: openApiKey });
const BASE_URL = "https://app.tgsrtclogistics.co.in/tsrtc/manifest/bookinghistory/468?bno=";

const statusTemplate = `Given the following context of the code.
Context: {context}
Question: What is the status of the code, where the delivery was received, what was the original manifest, from where the code was booked, when the delivery was arrived?
Answer:`;

const STATUS_PROMPT = PromptTemplate.fromTemplate(statusTemplate);

const dataCache = {};
const chatMemory = {}; 

const formatDataAsContext = (dataArray) => {
  return dataArray.map(obj => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  }).join("\n\n");
};

const getObjectFromCode = async (code) => {
  if (dataCache[code]) {
    return dataCache[code];
  }

  return new Promise((resolve, reject) => {
    request(`${BASE_URL}${code}`, (error, response, html) => {
      if (error || response.statusCode !== 200) {
        return reject('Failed to fetch data');
      }

      const $ = cheerio.load(html);
      const dataArray = [];

      $(".content .data").each((i, el) => {
        const heading = $(el).children('h1').text().trim();
        const paragraph = $(el).children('p').text().replace(/\s+/g, ' ').trim();

        if (heading && paragraph) {
          const dataObject = {};
          dataObject[heading] = paragraph;
          dataArray.push(dataObject);
        }
      });

      const context = formatDataAsContext(dataArray);
      dataCache[code] = context;
      chatMemory[code] = context; 

    //   console.log(context)
      resolve(context);
    });
  });
};

const answerQuestion = async (query) => {
  const match = query.match(/\d+/);

  if (!match) {
    const lastCode = Object.keys(chatMemory).pop();
    if (lastCode) {
      const context = chatMemory[lastCode];
      const result = await getAnswerFromContext(context, query);
      console.log(result);
    } else {
      console.log(`I can provide the information on ${query}, but I need a status code to proceed.`);
    }
    return;
  }

  const code = match[0];

  try {
    const context = await getObjectFromCode(code);
    const result = await getAnswerFromContext(context, 'What is the status of the code?');
    console.log(result);
  } catch (error) {
    console.error('Error:', error);
  }
};

const getAnswerFromContext = async (context, question) => {
  const result = await RunnableSequence.from([
    {
      context: () => context,
      question: new RunnablePassthrough()
    },
    STATUS_PROMPT,
    model,
    new StringOutputParser()
  ]).invoke({ question });

  return result;
};

// Example usage
answerQuestion('what happened to  22753099');
// answerQuestion('how many items were received?');

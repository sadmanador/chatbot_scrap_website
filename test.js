const dotenv = require('dotenv');
dotenv.config();

const cheerio = require('cheerio');
const request = require('request');
const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence, RunnablePassthrough } = require("@langchain/core/runnables");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { StringOutputParser } = require("@langchain/core/output_parsers");

const openApiKey = process.env.OPENAI_API_KEY;
const model = new ChatOpenAI({ apiKey: openApiKey });
const embeddings = new OpenAIEmbeddings();

const statusTemplate = `Given the following context, answer the status of the code.
Context: {context}
Question: What is the status of the code?
Answer:`;

const STATUS_PROMPT = PromptTemplate.fromTemplate(statusTemplate);

const combineDocumentsFn = (docs, separator = "\n\n") => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

const standaloneQuestionChain = RunnableSequence.from([
  {
    context: (input) => combineDocumentsFn(input.docs),
    question: new RunnablePassthrough()
  },
  STATUS_PROMPT,
  model,
  new StringOutputParser()
]);

const BASE_URL = "https://app.tgsrtclogistics.co.in/tsrtc/manifest/bookinghistory/468?bno=";

const getObjectFromCode = async (code) => {
  return new Promise((resolve, reject) => {
    request(`${BASE_URL}${code}`, async (error, response, html) => {
      if (error || response.statusCode != 200) {
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

      // Vectorize and store data
      const texts = dataArray.map(obj => Object.values(obj).join(' ')); // Join all object values into a single string
      const vectorStore = await MemoryVectorStore.fromTexts(texts, texts.map((_, index) => ({ id: index + 1 })), embeddings);

      resolve(vectorStore);
    });
  });
};

const answerQuestion = async (code) => {
  try {
    const vectorStore = await getObjectFromCode(code);
    
    // Use the correct method for document retrieval
    const retriever = vectorStore.asRetriever();
    const results = await retriever.retrieve(); // Adjust based on the library's documentation

    if (!results || results.length === 0) {
      throw new Error('No documents retrieved');
    }

    const result = await standaloneQuestionChain.invoke({
      question: 'What is the status of the code?',
      docs: results
    });

    console.log(result);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Example usage
answerQuestion('22753043');
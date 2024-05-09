// Define graph here

import fs from "fs";
import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { DatasetSchema } from "types.js";
import { TRIMMED_CORPUS_PATH } from "constants.js";

import { extractCategory } from "tools/extract_category.js";
import { selectApi } from "tools/select_api.js";
import { extractParameters } from "tools/extract_parameters.js";
import { requestParameters } from "tools/request_parameters.js";
import { findMissingParams } from "utils.js";

export type GraphState = {
  /**
   * The LLM to use for the graph
   */
  llm: ChatOpenAI;

  /**
   * The query to extract an API for
   */
  query: string;

  /**
   * The relevant API categories for the query
   */
  categories: string[] | null;

  /**
   * The relevant APIs for the given category
   */
  apis: DatasetSchema[] | null;

  /**
   * The most relevant API for the query
   */
  bestApi: DatasetSchema | null;

  /**
   * Params for the API query
   */
  params: Record<string, string> | null;

  /**
   * The API response
   */
  response: Record<string, unknown> | null;
};

const graphChannels = {
  llm: {
    value: null,
  },
  query: {
    value: null,
  },
  categories: {
    value: null,
  },
  apis: {
    value: null,
  },
  bestApi: {
    value: null,
  },
  params: {
    value: null,
  },
  response: {
    value: null,
  },
};

/**
 * @param {GraphState} state
 */
const verifyParams = (
  state: GraphState
): GraphNode.HumanInTheLoop | GraphNode.ExecuteFetchRequest => {
  const { bestApi, params } = state;

  if (!bestApi) throw new Error("No best API found");

  if (!params) return GraphNode.HumanInTheLoop;

  const requiredParams = bestApi.required_parameters.map((param) => param.name);
  const extractedParams = Object.keys(params);

  const missingParams = findMissingParams(requiredParams, extractedParams);

  if (missingParams.length) return GraphNode.HumanInTheLoop;
  else return GraphNode.ExecuteFetchRequest;
};

const getApis = (state: GraphState): Partial<GraphState> => {
  const { categories } = state;

  if (!categories?.length) {
    throw new Error(
      `No categories provided to ${GraphNode.GetApisInCategory} node.`
    );
  }

  const allData: DatasetSchema[] = JSON.parse(
    fs.readFileSync(TRIMMED_CORPUS_PATH, "utf8")
  );

  const apis = categories.flatMap((category) =>
    allData.filter((data) => data.category_name === category)
  );

  return { apis };
};

enum GraphNode {
  ExtractCategory = "extract_category",
  GetApisInCategory = "get_apis_in_category",
  SelectApi = "select_api",
  ExtractApiParamsFromQuery = "extract_api_params_from_query",
  HumanInTheLoop = "human_in_the_loop",
  ExecuteFetchRequest = "execute_fetch_request",
}

function createGraph() {
  /**
   * Setup the graph
   */

  const graph = new StateGraph<GraphState>({
    channels: graphChannels,
  });

  /**
   * Define nodes
   */

  graph.addNode(GraphNode.ExtractCategory, extractCategory);
  graph.addNode(GraphNode.GetApisInCategory, getApis);
  graph.addNode(GraphNode.SelectApi, selectApi);
  graph.addNode(GraphNode.ExtractApiParamsFromQuery, extractParameters);
  graph.addNode(GraphNode.HumanInTheLoop, requestParameters);
  graph.addNode(GraphNode.ExecuteFetchRequest, (state: GraphState) => {
    console.log("Not implemented", state);
  });

  /**
   * Define edges
   */

  graph.addEdge(GraphNode.ExtractCategory, GraphNode.GetApisInCategory);
  graph.addEdge(GraphNode.GetApisInCategory, GraphNode.SelectApi);
  graph.addEdge(GraphNode.SelectApi, GraphNode.ExtractApiParamsFromQuery);

  /**
   * Define conditional edges
   */

  graph.addConditionalEdges(GraphNode.ExtractApiParamsFromQuery, verifyParams);
  graph.addConditionalEdges(GraphNode.HumanInTheLoop, verifyParams);

  /**
   * Define entry and finish point
   */

  graph.setEntryPoint(GraphNode.ExtractCategory);
  graph.setFinishPoint(GraphNode.ExecuteFetchRequest);

  /**
   * Compile the graph
   */

  const app = graph.compile();

  return app;
}

const datasetQuery =
  "I'm researching WhatsApp for Business accounts. Can you check if the number 9876543210 is a WhatsApp for Business account? Also, provide the business description, website, email, business hours, address, and category if it is.";

const relevantIds = [
  "8044d241-0f5b-403d-879a-48b080fd4bf6",
  "a7c44eb0-c7f2-446a-b57e-45d0f629c50c",
  "f657180c-3685-410d-8c71-a5f7632602f1",
];

/**
 * @param {string} query
 */
async function main(query: string) {
  const app = createGraph();

  const llm = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0,
  });

  const response = await app.invoke({ llm, query });

  console.log(response);
}

main(datasetQuery);

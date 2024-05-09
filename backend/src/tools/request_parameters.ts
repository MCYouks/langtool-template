import * as readline from "readline";

import { GraphState } from "index.js";
import { DatasetParameters } from "types.js";
import { findMissingParams } from "utils.js";

const paramsFormat = `<name>,<value>:::<name>,<value>`;

/**
 * Read the user input from the command line
 * TODO: implement & add args
 * @param {DatasetParameters[]} missingParams
 */
export function readUserInput(
  missingParams: DatasetParameters[]
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const missingParamsString = missingParams
    .map((param) => `Name: ${param.name}, Description: ${param.description}`)
    .join("\n----\n");

  const question = `LangTool couldn't find all the required params for the API. \nMissing params: ${missingParamsString} \nPlease enter the parameters in the format ${paramsFormat}:\n`;

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Parse the user input string into a key-value pair
 * TODO: implement
 * @param {string} input
 */
export function parseUserInput(input: string): Record<string, string> {
  const splitParams = input.split(":::");
  const providedParams = splitParams.reduce(
    (params: Record<string, string>, chunk) => {
      const [key, value] = chunk.split(",");
      params[key] = value;
      return params;
    },
    {}
  );

  return providedParams;
}

/**
 * TODO: implement
 * @param {GraphState} state
 */
export async function requestParameters(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { llm, bestApi, params } = state;

  if (!bestApi) throw new Error("No best API found");

  const requiredParams = bestApi.required_parameters.map((param) => param.name);
  const extractedParams = Object.keys(params ?? {});
  const missingParams = findMissingParams(requiredParams, extractedParams);

  const missingParamsSchema = missingParams
    .map((missingParamName) =>
      bestApi.required_parameters.find(
        (param) => param.name === missingParamName
      )
    )
    .filter(Boolean) as DatasetParameters[];

  const userInput = await readUserInput(missingParamsSchema);
  const parsedUserInput = parseUserInput(userInput);

  console.log(
    `\n----------\nNew parsed param: ${JSON.stringify(
      parsedUserInput,
      null,
      2
    )}`
  );

  return {
    params: {
      ...params,
      ...parsedUserInput,
    },
  };
}

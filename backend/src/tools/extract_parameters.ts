import { GraphState } from "index.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { z } from "zod";

/**
 * TODO: implement
 * @param {GraphState} state
 */
export async function extractParameters(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { llm, query, bestApi } = state;

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`You are an expert software engineer helping junior engineer. You are provided with a list of required and option parameters for an API, along with a user's query.
    
    Given the query parameters, use the 'extract_params' tool to extract the parameters from the query.
    
    If the query does not contain any of the parameters, return an empty object.
    
    <required_parameters>
    {requiredParameters}
    </required_parameters>

    <optional_parameters>
    {optionalParameters}
    </optional_parameters>
    `),
    HumanMessagePromptTemplate.fromTemplate(`Query: {query}`),
  ]);

  const schema = z.object({
    params: z
      .record(z.string())
      .describe("The params extracted from the query."),
  });

  const modelWithTools = llm.withStructuredOutput(schema, {
    name: "extract_params",
  });

  const chain = prompt.pipe(modelWithTools);

  const { params } = await chain.invoke({
    query,
    requiredParameters: bestApi?.required_parameters
      .map(
        (param) =>
          `Name: ${param.name}, Description: ${param.description}, Type: ${param.type}, Default value: ${param.default}`
      )
      .join("\n"),
    optionalParameters: bestApi?.optional_parameters
      .map(
        (param) =>
          `Name: ${param.name}, Description: ${param.description}, Type: ${param.type}, Default value: ${param.default}`
      )
      .join("\n"),
  });

  return { params };
}

import { GraphState } from "index.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "langchain/prompts";

/**
 * TODO: implement
 * @param {GraphState} state
 */
export async function extractParameters(state: GraphState): Promise<Partial<GraphState>> {
  const { llm, query, bestApi } = state

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`You are an expert software engineer helping junior engineer. You are provided with a list of required and option parameters for an API, along with a user's query.
    
    Given the query parameters, use the 'extract_params' tool to extract the parameters from the query.
    
    If the query does not contain any of the parameters, return an empty object.`),
    HumanMessagePromptTemplate.fromTemplate(``)
  ])

  if (!bestApi) throw new Error("Best API must be defined when passing to extract_parameters node")

  const { required_parameters, optional_parameters } = bestApi 
}

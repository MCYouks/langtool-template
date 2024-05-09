/* eslint-disable max-len */
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { GraphState } from "index.js";
import { HIGH_LEVEL_CATEGORY_MAPPING } from "constants.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";



/**
 * Given a users query, extract the high level category which
 * best represents the query.
 */
export class ExtractHighLevelCategories extends StructuredTool {
  schema = z.object({
    highLevelCategories: z.array(z.enum(Object.keys(HIGH_LEVEL_CATEGORY_MAPPING) as [string, ...string[]])).describe("Represents the high level categories which best represent the user query.")
  })

  name = "ExtractHighLevelCategories";

  description = "Extracts the high level category which best represent the user query.";

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const categoriesMapped = input.highLevelCategories.map(category => HIGH_LEVEL_CATEGORY_MAPPING[category as keyof typeof HIGH_LEVEL_CATEGORY_MAPPING]).flat()
    return JSON.stringify(categoriesMapped)
  }
}

/**
 * TODO: implement
 * @param {GraphState} state
 */
export async function extractCategory(state: GraphState): Promise<Partial<GraphState>> {
  const { llm, query } = state

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
      You are an expert software engineer helping junior engineer understand the high level category of a query.
      Given their query and a list of high level categories, select the high level category which best represent the query.
    `),
    HumanMessagePromptTemplate.fromTemplate(`
      <query>
      {query}
      </query>

      <high_level_categories>
      {highLevelCategories}
      </high_level_categories>
    `)
  ])

  const tool = new ExtractHighLevelCategories()

  const modelWithStructuredOutput = llm.withStructuredOutput(tool.schema)

  const chain = prompt.pipe(modelWithStructuredOutput).pipe(tool)

  const response = await chain.invoke({
    query,
    highLevelCategories: Object.entries(HIGH_LEVEL_CATEGORY_MAPPING).map(([key, values]) => `High level category: ${key} \nCategories: ${values.join(', ')}`).join(`\n\n`)
  })

  const categories: string[] = JSON.parse(response)

  return {
    categories
  }
}

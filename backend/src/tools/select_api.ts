import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { GraphState } from "index.js";
import { DatasetSchema } from "types.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";

/**
 * Given a users query, choose the API which best
 * matches the query.
 */
export class SelectAPITool extends StructuredTool {
  schema: z.ZodObject<
    {
      api: z.ZodEnum<[string, ...string[]]>;
    },
    "strip",
    z.ZodTypeAny,
    {
      api: string;
    },
    {
      api: string;
    }
  >;

  name = "Select_API";

  description: string;

  apis: DatasetSchema[];

  /**
   * constructor
   * @param {DatasetSchema[]} apis
   */
  constructor(apis: DatasetSchema[], query: string) {
    super();
    this.description = SelectAPITool.createDescription(apis, query)
    this.schema = z.object({
      api: z.enum(apis.map(api => api.api_name) as [string, ...string[]]).describe("The name of the API which best matches the query")
    })
    this.apis = apis
  }

  /**
   *
   * @param {DatasetSchema[]} apis
   * @param {string} query
   * @returns {String}
   */
  static createDescription(apis: DatasetSchema[], query: string): string {
    const description = `Given the following user's query, select the api which will best serve the query.
    
    Query: ${query}
    
    APIs:
    ${apis.map(api => `
      Tool name: ${api.tool_name}
      API name: ${api.api_name}
      Description: ${api.api_description} 
      Parameters: \n${[...api.required_parameters, ...api.optional_parameters].map(param => ` - Name: ${param.name}, Description: ${param.description}`).join("\n")}`).join("\n---\n")}
    `

    return description
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const { api: apiName } = input
    const bestApi = this.apis.find(api => api.api_name === apiName)
    if (!bestApi) {
      throw new Error(`API ${apiName} was not found in the list of APIs: ${this.apis.map(api => api.api_name).join(', ')}`)
    }
    return JSON.stringify(bestApi)
  }
}

/**
 * TODO: implement
 * @param {GraphState} state
 */
export async function selectApi(state: GraphState): Promise<Partial<GraphState>> {
  const { llm, query, apis } = state;

  if (!apis?.length) throw new Error(`No APIs passed to the select_api node`)

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
      You are an expert software engineer helping junior engineer select the best API to perform their query.
      Given their query and a list of possible APIs, select the API which will best serve the query.
    `),
    HumanMessagePromptTemplate.fromTemplate(`
      <query>
      {query}
      </query>

      <apis>
      {apis}
      </apis>
    `)
  ])

  const tool = new SelectAPITool(apis, query)

  const modelWithStructuredOutput = llm.withStructuredOutput(tool.schema);

  const chain = prompt.pipe(modelWithStructuredOutput).pipe(tool)

  const response = await chain.invoke({
    query,
    apis: apis.map(api => `
      Tool name: ${api.tool_name}
      API name: ${api.api_name}
      Description: ${api.api_description} 
      Parameters: \n${[...api.required_parameters, ...api.optional_parameters].map(param => `  - Name: ${param.name}, Description: ${param.description}`).join("\n")}`).join("\n---\n")
  })

  const bestApi: DatasetSchema = JSON.parse(response)

  return { bestApi }
}

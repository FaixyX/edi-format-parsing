from openai import OpenAI

client = OpenAI()

print(client.api_key)

response = client.responses.create(
    prompt={
        "id": "pmpt_686da965d324819793e392b2d4d61de30d96ba961ae6bd3d",
    },
    input="Write a one-sentence bedtime story about a unicorn.",
)

print(response.output_text)

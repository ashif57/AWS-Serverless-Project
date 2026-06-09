import boto3, os

table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])

def lambda_handler(event, context):
    try:
        short_id = event['pathParameters']['id']
        response = table.get_item(Key={'short_id': short_id})

        if 'Item' in response:
            return {
                'statusCode': 301,
                'headers': {'Location': response['Item']['long_url']}
            }
        return {'statusCode': 404, 'body': 'Not Found'}
    except:
        return {'statusCode': 500, 'body': 'Error'}
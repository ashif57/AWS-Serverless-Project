import json, boto3, string, random, os
from botocore.exceptions import ClientError

table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])

def generate_id():
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(6))

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        long_url = body['url']
        custom_id = body.get('custom_id')

        short_id = custom_id if custom_id else generate_id()
        is_custom = bool(custom_id)

        try:
            table.put_item(
                Item={'short_id': short_id, 'long_url': long_url},
                ConditionExpression='attribute_not_exists(short_id)'
            )
            return {'statusCode': 200, 'body': json.dumps({'message': 'URL Created', 'short_id': short_id, 'original_url': long_url})}
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                if is_custom:
                    return {'statusCode': 409, 'body': json.dumps({'error': f"Custom ID '{custom_id}' is already taken."})}
                return {'statusCode': 500, 'body': json.dumps({'error': "ID collision. Please try again."})}
            raise e
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
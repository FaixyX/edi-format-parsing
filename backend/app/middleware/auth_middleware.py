from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import List
from app.models.user import UserType
from app.services.jwt_service import decode_token

security = HTTPBearer()

# this middleware is not used currently 
def check_roles(allowed_roles: List[UserType]):
    async def role_checker(
        credentials: HTTPAuthorizationCredentials = Security(security),
    ):
        try:
            token = credentials.credentials
            payload = decode_token(token)
            if payload["type"] not in allowed_roles:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to perform this action",
                )
            return payload
        except Exception as e:
            raise HTTPException(
                status_code=401, detail="Invalid authentication credentials"
            )

    return role_checker

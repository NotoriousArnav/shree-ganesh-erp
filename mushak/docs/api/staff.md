# Staff API

Staff endpoints let a shop owner create and manage counter accounts. They are
owner-only: every call requires the `merchant` role. Staff accounts get `403`
even when they have every permission.

| Operation | Path |
| --- | --- |
| List staff | `GET /api/merchant/staff` |
| Create staff | `POST /api/merchant/staff` |
| Update staff | `PATCH /api/merchant/staff/{id}` |
| Reset password | `POST /api/merchant/staff/{id}/password` |

The `{id}` is the Better Auth user id. Only staff in the caller's shop are
visible; another shop's id returns `404 Staff member not found`.

## List staff

`GET /api/merchant/staff`

Returns staff accounts sorted by name. The owner is not included.

```json
[
  {
    "id": "user_staff1",
    "name": "Sushrita Saha",
    "email": "sushrita@shop.in",
    "phoneNumber": "+919876543210",
    "permissions": ["stock"],
    "active": true,
    "createdAt": "2026-11-02T09:00:00.000Z"
  }
]
```

`active` is the inverse of the stored `banned` flag. `permissions` is
normalised to the known values, in a stable order.

## Create staff

`POST /api/merchant/staff`

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `name` | string | Yes | 1 to 120 characters |
| `email` | string | Yes | Valid email, max 160; stored lowercase |
| `password` | string | Yes | 8 to 128 characters |
| `phoneNumber` | string \| null | No | 7 to 15 digits, optional `+`; ten digits become `+91…` |
| `permissions` | string[] | No | `stock`, `catalogue`, `categories`; default `["stock"]` |

```bash
curl -s -b /tmp/mushak.cookies \
  -H 'content-type: application/json' \
  -d '{
    "name":"Sushrita Saha",
    "email":"sushrita@shop.in",
    "phoneNumber":"9876543210",
    "password":"sushrita-pass-123",
    "permissions":["stock"]
  }' \
  http://localhost:8080/api/merchant/staff
```

Returns `201` with the same shape as a list row.

The account can sign in immediately. Its role is `staff`, it is linked to the
owner's shop, and it starts unbanned.

### Errors

| Status | Meaning |
| --- | --- |
| `400` | Validation failed |
| `403` | Not the shop owner |
| `409` | `Another account already uses that email address.` or the phone equivalent |

## Update staff

`PATCH /api/merchant/staff/{id}`

Accepts any subset of:

| Field | Type | Effect |
| --- | --- | --- |
| `name` | string | Display name |
| `phoneNumber` | string \| null | `null` clears the phone |
| `permissions` | string[] | Replaces the whole list; `[]` means view-only |
| `active` | boolean | `false` deactivates and deletes all sessions; `true` reactivates |

```json
{
  "permissions": ["stock", "catalogue"],
  "active": true
}
```

At least one field is required; otherwise `400 No changes supplied`.
Email and password are not editable here.

Deactivating sets `banned=true`, stores the reason `Deactivated by shop owner`
and removes every session for the account. Reactivating clears the ban.

Returns the updated staff row.

## Reset a staff password

`POST /api/merchant/staff/{id}/password`

```json
{ "password": "a-new-password" }
```

| Rule | Value |
| --- | --- |
| Minimum | 8 characters |
| Maximum | 128 characters |

The password is hashed by Better Auth, the credential account is created if it
is missing, and every session for that staff member is deleted.

Returns:

```json
{ "id": "user_staff1", "passwordReset": true }
```

The owner cannot read the old password, and the response never contains the new
one.

## Permission behaviour

| Caller | List | Create | Update | Reset password |
| --- | --- | --- | --- | --- |
| Merchant (owner) | Yes | Yes | Yes | Yes |
| Staff, all permissions | `403` | `403` | `403` | `403` |
| Platform admin | `403` on this path | `403` | `403` | `403` |

Platform administrators create owners through
[`/api/admin/merchants/{merchantId}/users`](platform-admin.md#create-a-shop-owner),
not through this endpoint.

## Related

- [Staff and permissions guide](../user-guide/09-staff-and-permissions.md)
- [Permissions matrix](../reference/permissions.md)
- [Authentication](auth.md)

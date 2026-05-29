# Tournament Reward Repair Workflow

Use this workflow when a completed tournament winner does not show the expected prize card.

## Steps

1. Open Admin > Integrity Console.
2. Enter the completed competition ID.
3. Run reward integrity first.
4. Review findings before repairing.
5. Run reward repair only when findings are present.
6. Run reward integrity again.
7. Confirm the winning user has the prize card in their collection.

## Finding types

- `missing_card`: the winning entry expected a prize card but has no prize card id.
- `owner_mismatch`: the prize card exists but belongs to the wrong user.
- `ok`: the prize card belongs to the correct user.

## Safety rule

Do not run repair blindly. Always check first, repair only shown issues, then check again.

## Manual verification

After repair, verify:

- The competition status is completed.
- The winner entry has a rank and prize card id.
- The prize card owner id equals the winner user id.
- The card is not listed for sale.
- The user collection shows the card.

## Backend endpoints

- `GET /api/admin/competitions/:id/reward-integrity`
- `POST /api/admin/competitions/:id/repair-rewards`

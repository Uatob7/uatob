rm -rf node_modules
rm package-lock.json

for fn in $(gcloud functions list --region=us-east1 --format="value(name)")
do
  gcloud functions deploy $fn \
    --region=us-east1 \
    --memory=1Gi
done
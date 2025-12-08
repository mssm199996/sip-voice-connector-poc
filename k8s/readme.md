
### How to guide:
- We create the configmap on K8S to contain the kamailio configuration script:
  `kubectl create configmap kamailio-config --from-file=kamailio.cfg --from-file=kamctlrc -n fleet-control --dry-run=client -o yaml | kubectl apply -f -`
- After changing the configmap, you have to restart the kamailio deployment as this:
  `kubectl rollout restart deployment kamailio -n fleet-control`